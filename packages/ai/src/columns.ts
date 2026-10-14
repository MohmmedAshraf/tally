import { generateText, Output, type LanguageModel } from 'ai'
import {
  TallyError,
  columnLabel,
  type Column,
  type DataSource,
  type QueryRequest,
  type QueryResponse,
  type RowData,
  type RowKey,
  type RowPatch,
  type Schema,
} from 'tally-core'
import { z } from 'zod'

export interface AiCache {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

export interface AiColumnOptions {
  readonly column: string
  readonly model: LanguageModel
  readonly instruction: string
  readonly inputs?: readonly string[] | undefined
  readonly batchSize?: number | undefined
  readonly concurrency?: number | undefined
  readonly cache?: AiCache | undefined
}

export interface AiSource extends DataSource {
  subscribe(onPatch: (patch: RowPatch) => void): () => void
  pending(column?: string): ReadonlySet<RowKey>
  idle(): Promise<void>
}

interface AiColumn {
  readonly options: AiColumnOptions
  readonly column: Column
  readonly inputs: readonly Column[]
  readonly cache: AiCache
  readonly queued: Set<RowKey>
  readonly inFlight: Set<RowKey>
  running: number
}

const DEFAULT_BATCH = 20
const DEFAULT_CONCURRENCY = 2

const answerSchema = z.object({
  results: z.array(
    z.object({
      key: z.string().describe('The row key exactly as given'),
      value: z
        .string()
        .nullable()
        .describe('The computed value, or null when it cannot be determined'),
    }),
  ),
})

function typeHint(column: Column, kind: string): string {
  switch (kind) {
    case 'enum':
      return `Answer with exactly one of: ${(column.options ?? []).map((option) => option.value).join(', ')}.`
    case 'number':
      return 'Answer with a plain number, no units or separators.'
    case 'boolean':
      return 'Answer with true or false.'
    case 'date':
      return 'Answer with an ISO date such as 2026-01-15.'
    default:
      return 'Answer with short plain text.'
  }
}

function systemPrompt(schema: Schema, entry: AiColumn): string {
  const kind = schema.typeOf(entry.column).kind
  return [
    `You fill the column "${columnLabel(entry.column)}" for rows of a table.`,
    entry.options.instruction,
    'Each row is given as a JSON object with its key and the input columns.',
    'Return one result per row with the same key.',
    typeHint(entry.column, kind),
  ].join('\n')
}

function inputColumns(schema: Schema, options: readonly AiColumnOptions[], own: AiColumnOptions) {
  const aiIds = new Set(options.map((entry) => entry.column))
  const ids = own.inputs ?? schema.columns.map((column) => column.id).filter((id) => !aiIds.has(id))
  return ids.map((id) => schema.requireColumn(id))
}

function cacheKey(entry: AiColumn, key: RowKey, row: RowData): string {
  const inputs = entry.inputs.map((column) => row[column.id])
  return `${entry.column.id}:${String(key)}:${JSON.stringify(inputs)}`
}

function assertComputed(schema: Schema, id: string): Column {
  const column = schema.column(id)
  if (column === undefined) {
    throw new TallyError('unknown_column', `Column "${id}" is not in the schema`)
  }
  const flags = [column.filterable, column.sortable, column.groupable]
  if (flags.some((flag) => flag !== false)) {
    throw new TallyError(
      'invalid_column',
      `AI column "${id}" must set filterable, sortable and groupable to false`,
    )
  }
  return column
}

export function withAiColumns(
  source: DataSource,
  schema: Schema,
  columns: readonly AiColumnOptions[],
): AiSource {
  const entries: readonly AiColumn[] = columns.map((options) => ({
    options,
    column: assertComputed(schema, options.column),
    inputs: inputColumns(schema, columns, options),
    cache: options.cache ?? new Map<string, unknown>(),
    queued: new Set(),
    inFlight: new Set(),
    running: 0,
  }))
  const latest = new Map<RowKey, RowData>()
  const listeners = new Set<(patch: RowPatch) => void>()
  let idleWaiters: (() => void)[] = []

  const busy = (): boolean => entries.some((entry) => entry.queued.size > 0 || entry.running > 0)
  const settle = (): void => {
    if (busy()) return
    const waiters = idleWaiters
    idleWaiters = []
    for (const resolve of waiters) resolve()
  }
  const emit = (patch: RowPatch): void => {
    for (const listener of listeners) listener(patch)
  }

  const enrich = (row: RowData): RowData => {
    const key = schema.keyOf(row)
    let next = row
    for (const entry of entries) {
      const cached = entry.cache.get(cacheKey(entry, key, row))
      if (cached !== undefined) {
        next = { ...next, [entry.column.id]: cached }
      } else if (!entry.inFlight.has(key)) {
        entry.queued.add(key)
      }
    }
    latest.set(key, next)
    return next
  }

  const compute = async (entry: AiColumn, keys: readonly RowKey[]): Promise<void> => {
    const rows = keys
      .map((key) => latest.get(key))
      .filter((row): row is RowData => row !== undefined)
    const lines = rows.map((row) =>
      JSON.stringify({
        key: String(schema.keyOf(row)),
        ...Object.fromEntries(entry.inputs.map((column) => [column.id, row[column.id]])),
      }),
    )
    const { output } = await generateText({
      model: entry.options.model,
      system: systemPrompt(schema, entry),
      prompt: lines.join('\n'),
      output: Output.object({ schema: answerSchema }),
    })
    const byKey = new Map(rows.map((row) => [String(schema.keyOf(row)), row] as const))
    const type = schema.typeOf(entry.column)
    const upserts: RowData[] = []
    for (const result of output.results) {
      const row = byKey.get(result.key)
      if (row === undefined) continue
      const value = result.value === null ? null : (type.parse(result.value, entry.column) ?? null)
      const key = schema.keyOf(row)
      entry.cache.set(cacheKey(entry, key, row), value)
      const current = latest.get(key) ?? row
      const next = { ...current, [entry.column.id]: value }
      latest.set(key, next)
      upserts.push(next)
    }
    if (upserts.length > 0) emit({ upserts })
  }

  const pump = (): void => {
    for (const entry of entries) {
      const concurrency = entry.options.concurrency ?? DEFAULT_CONCURRENCY
      const batchSize = entry.options.batchSize ?? DEFAULT_BATCH
      while (entry.running < concurrency && entry.queued.size > 0) {
        const keys = [...entry.queued].slice(0, batchSize)
        for (const key of keys) {
          entry.queued.delete(key)
          entry.inFlight.add(key)
        }
        entry.running += 1
        void compute(entry, keys)
          .catch(() => undefined)
          .finally(() => {
            for (const key of keys) entry.inFlight.delete(key)
            entry.running -= 1
            pump()
            settle()
          })
      }
    }
  }

  const query = async (request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> => {
    const response = await source.query(request, signal)
    const rows = response.rows.map(enrich)
    pump()
    return { ...response, rows }
  }

  const subscribe = (onPatch: (patch: RowPatch) => void): (() => void) => {
    listeners.add(onPatch)
    const stopInner = source.subscribe?.((patch) => {
      const upserts = patch.upserts?.map(enrich)
      onPatch({ ...patch, ...(upserts === undefined ? {} : { upserts }) })
      pump()
    })
    return () => {
      listeners.delete(onPatch)
      stopInner?.()
    }
  }

  const inner = { schema: source.schema?.bind(source), mutate: source.mutate?.bind(source) }
  return {
    capabilities: { ...source.capabilities, live: true },
    ...(inner.schema === undefined ? {} : { schema: inner.schema }),
    query,
    ...(inner.mutate === undefined ? {} : { mutate: inner.mutate }),
    subscribe,
    pending(column) {
      const keys = new Set<RowKey>()
      for (const entry of entries) {
        if (column !== undefined && entry.column.id !== column) continue
        for (const key of entry.queued) keys.add(key)
        for (const key of entry.inFlight) keys.add(key)
      }
      return keys
    },
    idle() {
      if (!busy()) return Promise.resolve()
      return new Promise((resolve) => idleWaiters.push(resolve))
    },
  }
}
