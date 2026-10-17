import { executeWith, type ExecutorOptions, type Summaries } from '../execute/executor.ts'
import { createFormatContext } from '../format/context.ts'
import { today } from '../format/date.ts'
import type { Filter } from '../query/ast.ts'
import { applyMutation, type Mutation } from '../rows/mutation.ts'
import type { RowData, RowKey } from '../rows/row.ts'
import type { RowPatch } from '../rows/store.ts'
import type { Schema } from '../schema/schema.ts'
import type {
  Capabilities,
  DataSource,
  OffsetPage,
  Pagination,
  QueryRequest,
  QueryResponse,
} from './data-source.ts'

export interface ArraySource extends DataSource {
  rows(): readonly RowData[]
  replace(rows: readonly RowData[]): void
  patch(patch: RowPatch): void
}

export interface ArraySourceOptions extends ExecutorOptions {
  readonly mutable?: boolean | undefined
  readonly pagination?: Pagination | undefined
}

function offsetPage(page: QueryRequest['page'], pagination: Pagination): OffsetPage | undefined {
  if (page === undefined) return undefined
  if ('offset' in page) return page
  if (pagination !== 'cursor') return undefined
  const offset = Number(page.cursor ?? 0)
  return { offset: Number.isSafeInteger(offset) && offset >= 0 ? offset : 0, limit: page.limit }
}

export const arrayCapabilities: Capabilities = {
  filter: true,
  sort: true,
  group: true,
  search: true,
  aggregates: true,
  facets: true,
  pagination: 'none',
  mutate: true,
  live: true,
}

export function createArraySource(
  initial: readonly RowData[],
  schema: Schema,
  options: ArraySourceOptions = {},
): ArraySource {
  let rows = initial
  let cache: {
    rows: readonly RowData[]
    entries: readonly (readonly [Filter | undefined, string, Summaries])[]
  } = { rows, entries: [] }
  const listeners = new Set<(patch: RowPatch) => void>()
  const pagination = options.pagination ?? 'none'
  const capabilities: Capabilities = {
    ...arrayCapabilities,
    mutate: options.mutable !== false,
    pagination,
  }
  const applyPatch = (patch: RowPatch): void => {
    const deletes = new Set(patch.deletes ?? [])
    const upserts = new Map((patch.upserts ?? []).map((row) => [schema.keyOf(row), row] as const))
    const next: RowData[] = []
    const seen = new Set<RowKey>()
    for (const row of rows) {
      const key = schema.keyOf(row)
      if (deletes.has(key)) continue
      const upsert = upserts.get(key)
      if (upsert !== undefined) seen.add(key)
      next.push(upsert ?? row)
    }
    for (const [key, row] of upserts) if (!seen.has(key)) next.push(row)
    rows = next
    for (const listener of listeners) listener(patch)
  }
  return {
    capabilities,
    rows: () => rows,
    replace: (next) => {
      rows = next
    },
    patch: applyPatch,
    schema: () => Promise.resolve(schema.columns),
    query: (request: QueryRequest): Promise<QueryResponse> => {
      const page = offsetPage(request.page, pagination)
      const day = options.today ?? today(options.format ?? createFormatContext())
      const key = JSON.stringify([request.facets, request.aggregates, day])
      if (cache.rows !== rows) cache = { rows, entries: [] }
      const hit = cache.entries.find(
        ([filter, known]) => filter === request.filter && known === key,
      )
      const result = executeWith(rows, { ...request, page }, schema, options, hit?.[2])
      if (hit === undefined) {
        const summaries = { aggregates: result.aggregates, facets: result.facets }
        cache.entries = [[request.filter, key, summaries], ...cache.entries.slice(0, 7)]
      }
      const next = page === undefined ? undefined : page.offset + page.limit
      const pageable = result.groups === undefined ? result.matched : result.groups.length
      return Promise.resolve({
        rows: result.rows,
        total: result.total,
        matched: result.matched,
        ...(pagination === 'cursor' && next !== undefined && next < pageable
          ? { cursor: String(next) }
          : {}),
        ...(result.groups === undefined
          ? {}
          : {
              groups: result.groups.map((group) => ({
                key: group.key,
                value: group.value,
                count: group.rows.length,
                aggregates: group.aggregates,
              })),
            }),
        ...(result.aggregates === undefined ? {} : { aggregates: result.aggregates }),
        ...(result.facets === undefined ? {} : { facets: result.facets }),
      })
    },
    mutate: (mutations: readonly Mutation[]) => {
      if (!capabilities.mutate) {
        return Promise.resolve({ accepted: false, errors: [{ message: 'Source is read only' }] })
      }
      for (const mutation of mutations) rows = applyMutation(rows, mutation, schema)
      const touched = new Set(
        mutations.flatMap((mutation) => mutation.changes.map((change) => change.key)),
      )
      return Promise.resolve({
        accepted: true,
        rows: rows.filter((row) => touched.has(schema.keyOf(row))),
      })
    },
    subscribe: (onPatch) => {
      listeners.add(onPatch)
      return () => listeners.delete(onPatch)
    },
  }
}
