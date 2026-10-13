import type { RelativeRange } from '../format/date.ts'
import { NEGATED_OPERATOR, type Operator } from '../types/operator.ts'

export type SortDirection = 'asc' | 'desc'

export interface Sort {
  readonly column: string
  readonly direction: SortDirection
}

export type GroupGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface Group {
  readonly column: string
  readonly granularity?: GroupGranularity | undefined
}

export interface Condition {
  readonly type: 'condition'
  readonly column: string
  readonly op: Operator
  readonly value?: unknown
}

export interface AndFilter {
  readonly type: 'and'
  readonly filters: readonly Filter[]
}

export interface OrFilter {
  readonly type: 'or'
  readonly filters: readonly Filter[]
}

export interface NotFilter {
  readonly type: 'not'
  readonly filter: Filter
}

export interface SearchFilter {
  readonly type: 'search'
  readonly text: string
}

export interface FlagFilter {
  readonly type: 'flag'
  readonly name: string
}

export type Filter = AndFilter | OrFilter | NotFilter | Condition | SearchFilter | FlagFilter

export interface Query {
  readonly filter?: Filter | undefined
  readonly sort: readonly Sort[]
  readonly group?: Group | undefined
}

export type RelativeValue = RelativeRange

export const emptyQuery: Query = { sort: [] }

export function condition(column: string, op: Operator, value?: unknown): Condition {
  return value === undefined
    ? { type: 'condition', column, op }
    : { type: 'condition', column, op, value }
}

export function search(text: string): SearchFilter {
  return { type: 'search', text }
}

export function flag(name: string): FlagFilter {
  return { type: 'flag', name }
}

function flatten(type: 'and' | 'or', filters: readonly Filter[]): Filter[] {
  return filters.flatMap((filter) =>
    filter.type === type ? flatten(type, filter.filters) : [filter],
  )
}

export function and(...filters: readonly (Filter | undefined)[]): Filter | undefined {
  const flat = flatten(
    'and',
    filters.filter((filter) => filter !== undefined),
  )
  if (flat.length === 0) return undefined
  if (flat.length === 1) return flat[0]
  return { type: 'and', filters: flat }
}

export function or(...filters: readonly (Filter | undefined)[]): Filter | undefined {
  const flat = flatten(
    'or',
    filters.filter((filter) => filter !== undefined),
  )
  if (flat.length === 0) return undefined
  if (flat.length === 1) return flat[0]
  return { type: 'or', filters: flat }
}

export function not(filter: Filter): Filter {
  if (filter.type === 'not') return filter.filter
  if (filter.type === 'condition') {
    const negated = NEGATED_OPERATOR[filter.op]
    if (negated !== undefined) return condition(filter.column, negated, filter.value)
  }
  return { type: 'not', filter }
}

export function isCondition(filter: Filter): filter is Condition {
  return filter.type === 'condition'
}

export function conditionsOf(filter: Filter | undefined): readonly Condition[] {
  if (filter === undefined) return []
  switch (filter.type) {
    case 'condition':
      return [filter]
    case 'and':
    case 'or':
      return filter.filters.flatMap(conditionsOf)
    case 'not':
      return conditionsOf(filter.filter)
    case 'search':
    case 'flag':
      return []
  }
}

export function columnsOf(query: Query): readonly string[] {
  const ids = new Set<string>()
  for (const item of conditionsOf(query.filter)) ids.add(item.column)
  for (const sort of query.sort) ids.add(sort.column)
  if (query.group !== undefined) ids.add(query.group.column)
  return [...ids]
}

export function isEmptyFilter(filter: Filter | undefined): boolean {
  return filter === undefined
}
