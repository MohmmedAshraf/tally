import type { AggregateRequest } from '../execute/aggregate.ts'
import type { ExecuteRequest } from '../execute/executor.ts'
import type { Filter } from '../query/ast.ts'
import type { Schema } from '../schema/schema.ts'
import type { Capabilities, CursorPage, OffsetPage, QueryRequest } from '../source/data-source.ts'
import type { View } from '../view/view.ts'

export interface QueryPlan {
  readonly request: QueryRequest
  readonly local: ExecuteRequest | undefined
}

function needsClient(filter: Filter, capabilities: Capabilities): boolean {
  switch (filter.type) {
    case 'search':
      return !capabilities.search
    case 'flag':
      return true
    case 'and':
    case 'or':
      return filter.filters.some((child) => needsClient(child, capabilities))
    case 'not':
      return needsClient(filter.filter, capabilities)
    case 'condition':
      return false
  }
}

export function facetColumns(schema: Schema): readonly string[] {
  return schema.columns
    .filter((column) => column.filterable !== false && schema.typeOf(column).facet !== 'none')
    .map((column) => column.id)
}

export function footerAggregates(view: View): readonly AggregateRequest[] {
  return Object.entries(view.footer).map(([column, fn]) => ({ column, fn }))
}

export function planQuery(
  view: View,
  schema: Schema,
  capabilities: Capabilities,
  page?: OffsetPage | CursorPage,
): QueryPlan {
  const filter = view.filter
  const remoteFilter =
    capabilities.filter && (filter === undefined || !needsClient(filter, capabilities))
  const aggregates = footerAggregates(view)
  const facets = facetColumns(schema)
  const request: QueryRequest = {
    version: 1,
    ...(remoteFilter && filter !== undefined ? { filter } : {}),
    sort: capabilities.sort ? view.sort : [],
    ...(capabilities.group && view.group !== undefined ? { group: view.group } : {}),
    ...(capabilities.pagination !== 'none' && page !== undefined ? { page } : {}),
    ...(capabilities.aggregates && aggregates.length > 0 ? { aggregates } : {}),
    ...(capabilities.facets && facets.length > 0 ? { facets } : {}),
  }
  const local: ExecuteRequest = {
    ...(!remoteFilter && filter !== undefined ? { filter } : {}),
    ...(!capabilities.sort && view.sort.length > 0 ? { sort: view.sort } : {}),
    ...(!capabilities.group && view.group !== undefined ? { group: view.group } : {}),
    ...(!capabilities.aggregates && aggregates.length > 0 ? { aggregates } : {}),
    ...(!capabilities.facets && facets.length > 0 ? { facets } : {}),
  }
  return { request, local: Object.keys(local).length === 0 ? undefined : local }
}
