import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import {
  type Capabilities,
  type DataSource,
  type Mutation,
  type MutationResult,
  type QueryRequest,
  type QueryResponse,
  type RowData,
  type RowKey,
  type RowPatch,
  type Schema,
  TallyError,
} from 'tally-core'
import { mutationIssues, rowDataSchema, validateQueryRequest } from 'tally-protocol'
import { z } from 'zod'
import { createCompiler, type Compiler } from './compile.ts'

export interface SupabaseSourceOptions {
  readonly client: SupabaseClient
  readonly table: string
  readonly schema: Schema
  readonly dbSchema?: string | undefined
  readonly columns?: Readonly<Record<string, string>> | undefined
  readonly pagination?: 'offset' | 'cursor' | undefined
  readonly maxLimit?: number | undefined
  readonly mutable?: boolean | undefined
  readonly realtime?: boolean | undefined
  readonly today?: string | undefined
}

export interface SupabaseSource extends DataSource {
  schema(): Promise<Schema['columns']>
  mutate(mutations: readonly Mutation[]): Promise<MutationResult>
  subscribe(onPatch: (patch: RowPatch) => void): () => void
}

const rowsSchema = z.array(rowDataSchema)

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ offset }))
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0
  try {
    const parsed: unknown = JSON.parse(atob(cursor))
    const offset =
      typeof parsed === 'object' && parsed !== null && 'offset' in parsed
        ? parsed.offset
        : undefined
    return typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
  } catch {
    return 0
  }
}

function failure(message: string): MutationResult {
  return { accepted: false, errors: [{ message }] }
}

async function sequence<T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> {
  await items.reduce<Promise<void>>((chain, item) => chain.then(() => run(item)), Promise.resolve())
}

interface Failure {
  readonly error: { readonly message: string } | null
}

function check(result: Failure): void {
  if (result.error !== null) throw new Error(result.error.message)
}

export function createSupabaseSource(options: SupabaseSourceOptions): SupabaseSource {
  const { client, table, schema } = options
  const keyField = schema.keyField
  if (keyField === undefined) {
    throw new TallyError('invalid_column', 'Supabase source needs a key field, not a key function')
  }
  const pagination = options.pagination ?? 'offset'
  const maxLimit = options.maxLimit ?? 1000
  const dbSchema = options.dbSchema ?? 'public'
  const capabilities: Capabilities = {
    filter: true,
    sort: true,
    group: false,
    search: true,
    aggregates: false,
    facets: false,
    pagination,
    mutate: options.mutable !== false,
    live: options.realtime !== false,
  }
  const compiler: Compiler = createCompiler({
    schema,
    today: options.today ?? todayIso(),
    key: keyField,
    columns: options.columns,
  })
  const keyName = compiler.name(keyField)
  const selection = compiler.selection()
  const fields = [...schema.columns.map((column) => column.id), keyField]
  const toDb = (row: RowData): Record<string, unknown> =>
    Object.fromEntries(
      fields.filter((field) => field in row).map((field) => [compiler.name(field), row[field]]),
    )
  const fromDb = (row: RowData): RowData =>
    Object.fromEntries(fields.map((field) => [field, row[compiler.name(field)]]))
  const from = () => client.schema(dbSchema).from(table)

  const page = (request: QueryRequest): { offset: number; limit: number } | undefined => {
    if (request.page === undefined) return undefined
    const limit = Math.min(maxLimit, request.page.limit)
    if ('offset' in request.page) return { offset: request.page.offset, limit }
    return { offset: decodeCursor(request.page.cursor), limit }
  }

  const query = async (request: QueryRequest): Promise<QueryResponse> => {
    validateQueryRequest(request, schema)
    const slice = page(request)
    let rowsQuery = from().select(selection, { count: 'exact' })
    if (request.filter !== undefined) rowsQuery = rowsQuery.or(compiler.filter(request.filter))
    for (const part of compiler.order(request.sort)) {
      rowsQuery = rowsQuery.order(part.column, { ascending: part.ascending, nullsFirst: false })
    }
    if (slice !== undefined) {
      rowsQuery = rowsQuery.range(slice.offset, slice.offset + slice.limit - 1)
    }
    const [rowsResult, totalResult] = await Promise.all([
      rowsQuery,
      from().select(keyName, { count: 'exact', head: true }),
    ])
    check(rowsResult)
    check(totalResult)
    const rows = rowsSchema.parse(rowsResult.data ?? [])
    const matched = rowsResult.count ?? rows.length
    const next = slice === undefined ? undefined : slice.offset + slice.limit
    return {
      rows,
      total: totalResult.count ?? matched,
      matched,
      ...(pagination === 'cursor' && next !== undefined && next < matched
        ? { cursor: encodeCursor(next) }
        : {}),
    }
  }

  const apply = async (mutation: Mutation): Promise<void> => {
    const deletes = mutation.deleted.map((removal) => schema.keyOf(removal.row))
    if (deletes.length > 0) check(await from().delete().in(keyName, deletes))
    const inserts = mutation.inserted.map((insert) => toDb(insert.row))
    if (inserts.length > 0) check(await from().insert(inserts))
    const patches = new Map<RowKey, Record<string, unknown>>()
    for (const change of mutation.changes) {
      patches.set(change.key, {
        ...patches.get(change.key),
        [compiler.name(change.column)]: change.to,
      })
    }
    await sequence([...patches.entries()], async ([key, patch]) =>
      check(await from().update(patch).eq(keyName, key)),
    )
  }

  const mutate = async (mutations: readonly Mutation[]): Promise<MutationResult> => {
    if (!capabilities.mutate) return failure('Source is read only')
    const issues = mutationIssues({ version: 1, mutations }, schema)
    if (issues.length > 0)
      return { accepted: false, errors: issues.map((message) => ({ message })) }
    try {
      await sequence(mutations, apply)
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Mutation failed')
    }
    const touched = [
      ...new Set(
        mutations.flatMap((mutation) => [
          ...mutation.changes.map((change) => change.key),
          ...mutation.inserted.map((insert) => schema.keyOf(insert.row)),
        ]),
      ),
    ]
    if (touched.length === 0) return { accepted: true, rows: [] }
    const result = await from().select(selection).in(keyName, touched).order(keyName)
    check(result)
    return { accepted: true, rows: rowsSchema.parse(result.data ?? []) }
  }

  const patchOf = (payload: RealtimePostgresChangesPayload<RowData>): RowPatch | undefined => {
    if (payload.eventType === 'DELETE') {
      const parsed = rowDataSchema.safeParse(payload.old)
      const key: unknown = parsed.success ? parsed.data[keyName] : undefined
      return typeof key === 'string' || typeof key === 'number' ? { deletes: [key] } : undefined
    }
    const parsed = rowDataSchema.safeParse(payload.new)
    return parsed.success ? { upserts: [fromDb(parsed.data)] } : undefined
  }

  const subscribe = (onPatch: (patch: RowPatch) => void): (() => void) => {
    const channel = client
      .channel(`tally:${dbSchema}.${table}:${crypto.randomUUID()}`)
      .on<RowData>('postgres_changes', { event: '*', schema: dbSchema, table }, (payload) => {
        const patch = patchOf(payload)
        if (patch !== undefined) onPatch(patch)
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }

  return {
    capabilities,
    schema: () => Promise.resolve(schema.columns),
    query,
    mutate,
    subscribe,
  }
}
