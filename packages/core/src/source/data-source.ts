import type { AggregateRequest, AggregateResults } from '../execute/aggregate.ts'
import type { Facets } from '../execute/facets.ts'
import type { Filter, Group, Sort } from '../query/ast.ts'
import type { Mutation } from '../rows/mutation.ts'
import type { RowData, RowKey } from '../rows/row.ts'
import type { RowPatch } from '../rows/store.ts'
import type { Column } from '../schema/column.ts'

export type Pagination = 'none' | 'offset' | 'cursor'

export interface Capabilities {
  readonly filter: boolean
  readonly sort: boolean
  readonly group: boolean
  readonly search: boolean
  readonly aggregates: boolean
  readonly facets: boolean
  readonly pagination: Pagination
  readonly mutate: boolean
  readonly live: boolean
}

export interface OffsetPage {
  readonly offset: number
  readonly limit: number
}

export interface CursorPage {
  readonly cursor?: string | undefined
  readonly limit: number
}

export interface QueryRequest {
  readonly version: 1
  readonly filter?: Filter | undefined
  readonly sort: readonly Sort[]
  readonly group?: Group | undefined
  readonly page?: OffsetPage | CursorPage | undefined
  readonly aggregates?: readonly AggregateRequest[] | undefined
  readonly facets?: readonly string[] | undefined
}

export interface GroupSummary {
  readonly key: string
  readonly value: unknown
  readonly count: number
  readonly aggregates: AggregateResults
}

export interface QueryResponse {
  readonly rows: readonly RowData[]
  readonly total?: number | undefined
  readonly matched?: number | undefined
  readonly cursor?: string | undefined
  readonly groups?: readonly GroupSummary[] | undefined
  readonly aggregates?: AggregateResults | undefined
  readonly facets?: Facets | undefined
}

export interface MutationError {
  readonly key?: RowKey | undefined
  readonly column?: string | undefined
  readonly message: string
}

export interface MutationResult {
  readonly accepted: boolean
  readonly rows?: readonly RowData[] | undefined
  readonly errors?: readonly MutationError[] | undefined
}

export interface DataSource {
  readonly capabilities: Capabilities
  schema?(): Promise<readonly Column[]>
  query(request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse>
  mutate?(mutations: readonly Mutation[]): Promise<MutationResult>
  subscribe?(onPatch: (patch: RowPatch) => void): () => void
}

export const PROTOCOL_VERSION = 1 as const
