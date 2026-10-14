import type { Filter, Group, Sort } from '../query/ast.ts'
import type { RowData } from '../rows/row.ts'
import type { Schema } from '../schema/schema.ts'
import { aggregateRows, type AggregateRequest, type AggregateResults } from './aggregate.ts'
import { createExecutionContext, type ExecutionContext, type ExecutionOptions } from './context.ts'
import { computeFacets, type FacetOptions, type Facets } from './facets.ts'
import { groupRows, type RowGroup } from './group.ts'
import { compileFilter } from './predicate.ts'
import { compileSort } from './sort.ts'
import { withAncestors } from './tree.ts'

export interface Page {
  readonly offset: number
  readonly limit: number
}

export interface ExecuteRequest {
  readonly filter?: Filter | undefined
  readonly sort?: readonly Sort[] | undefined
  readonly group?: Group | undefined
  readonly page?: Page | undefined
  readonly aggregates?: readonly AggregateRequest[] | undefined
  readonly facets?: readonly string[] | undefined
}

export interface ExecuteResult {
  readonly rows: readonly RowData[]
  readonly total: number
  readonly matched: number
  readonly groups?: readonly RowGroup[] | undefined
  readonly aggregates?: AggregateResults | undefined
  readonly facets?: Facets | undefined
}

export interface ExecutorOptions extends ExecutionOptions {
  readonly facetOptions?: FacetOptions | undefined
}

export function execute(
  rows: readonly RowData[],
  request: ExecuteRequest,
  schema: Schema,
  options: ExecutorOptions = {},
): ExecuteResult {
  const context: ExecutionContext = createExecutionContext(options)
  const predicate = compileFilter(request.filter, schema, context)
  const filtered = request.filter === undefined ? rows : rows.filter(predicate)
  const kept =
    schema.hierarchical && request.filter !== undefined
      ? withAncestors(rows, filtered, schema)
      : filtered
  const sorts = request.sort ?? []
  const comparator = compileSort(sorts, schema, context)
  const sorted = comparator === undefined ? kept : kept.toSorted(comparator)
  const aggregates = request.aggregates ?? []
  const page = request.page
  const slice = <T>(list: readonly T[]): readonly T[] =>
    page === undefined ? list : list.slice(page.offset, page.offset + page.limit)
  let groups: readonly RowGroup[] | undefined
  let rowsOut = slice(sorted)
  if (request.group !== undefined) {
    groups = groupRows(sorted, request.group, sorts, schema, context, aggregates)
    rowsOut = slice(groups).flatMap((group) => group.rows)
  }
  return {
    rows: rowsOut,
    total: rows.length,
    matched: filtered.length,
    ...(groups === undefined ? {} : { groups }),
    ...(aggregates.length === 0
      ? {}
      : { aggregates: aggregateRows(filtered, aggregates, schema, context) }),
    ...(request.facets === undefined
      ? {}
      : { facets: computeFacets(filtered, request.facets, schema, context, options.facetOptions) }),
  }
}
