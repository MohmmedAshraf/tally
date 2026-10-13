import { execute, type ExecutorOptions } from '../execute/executor.ts'
import { applyMutation, type Mutation } from '../rows/mutation.ts'
import type { RowData } from '../rows/row.ts'
import type { RowPatch } from '../rows/store.ts'
import type { Schema } from '../schema/schema.ts'
import type { Capabilities, DataSource, QueryRequest, QueryResponse } from './data-source.ts'

export interface ArraySource extends DataSource {
  rows(): readonly RowData[]
  replace(rows: readonly RowData[]): void
  patch(patch: RowPatch): void
}

export interface ArraySourceOptions extends ExecutorOptions {
  readonly mutable?: boolean | undefined
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
  const listeners = new Set<(patch: RowPatch) => void>()
  const capabilities: Capabilities = { ...arrayCapabilities, mutate: options.mutable !== false }
  const applyPatch = (patch: RowPatch): void => {
    const deletes = new Set(patch.deletes ?? [])
    const upserts = new Map((patch.upserts ?? []).map((row) => [schema.keyOf(row), row] as const))
    const kept = rows
      .filter((row) => !deletes.has(schema.keyOf(row)))
      .map((row) => upserts.get(schema.keyOf(row)) ?? row)
    const known = new Set(kept.map((row) => schema.keyOf(row)))
    rows = [...kept, ...[...upserts.values()].filter((row) => !known.has(schema.keyOf(row)))]
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
      const page = request.page !== undefined && 'offset' in request.page ? request.page : undefined
      const result = execute(rows, { ...request, page }, schema, options)
      return Promise.resolve({
        rows: result.rows,
        total: result.total,
        matched: result.matched,
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
