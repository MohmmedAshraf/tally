import { isIsoDate, startOfIsoWeek } from '../format/date.ts'
import type { Group, GroupGranularity, Sort } from '../query/ast.ts'
import type { RowData } from '../rows/row.ts'
import type { Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import { isEmptyValue } from '../types/column-type.ts'
import { aggregateRows, type AggregateRequest, type AggregateResults } from './aggregate.ts'
import type { ExecutionContext } from './context.ts'

export interface RowGroup {
  readonly key: string
  readonly value: unknown
  readonly rows: readonly RowData[]
  readonly aggregates: AggregateResults
}

function bucketDate(value: string, granularity: GroupGranularity): string {
  switch (granularity) {
    case 'day':
      return value
    case 'week':
      return startOfIsoWeek(value)
    case 'month':
      return value.slice(0, 7)
    case 'quarter':
      return `${Number(value.slice(0, 4))}-Q${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1}`
    case 'year':
      return String(Number(value.slice(0, 4)))
  }
}

export function groupValueOf(
  row: RowData,
  column: Column,
  schema: Schema,
  granularity: GroupGranularity,
): unknown {
  const value = schema.valueOf(row, column)
  if (isEmptyValue(value)) return null
  if (schema.typeOf(column).kind === 'date' && typeof value === 'string' && isIsoDate(value)) {
    return bucketDate(value, granularity)
  }
  return value
}

export function groupKeyOf(value: unknown): string {
  return value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value)
}

export function groupRows(
  rows: readonly RowData[],
  group: Group,
  sorts: readonly Sort[],
  schema: Schema,
  context: ExecutionContext,
  aggregates: readonly AggregateRequest[] = [],
): readonly RowGroup[] {
  const column = schema.column(group.column)
  if (column === undefined) return []
  const type = schema.typeOf(column)
  const granularity = group.granularity ?? 'month'
  const buckets = new Map<string, { value: unknown; rows: RowData[] }>()
  for (const row of rows) {
    const value = groupValueOf(row, column, schema, granularity)
    const key = groupKeyOf(value)
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, { value, rows: [row] })
    else bucket.rows.push(row)
  }
  const sortedByGroup = sorts.find((sort) => sort.column === column.id)
  const entries = [...buckets.entries()]
  if (sortedByGroup === undefined) {
    const sign = type.kind === 'date' ? -1 : 1
    entries.sort(([, a], [, b]) => {
      if (a.value === null) return 1
      if (b.value === null) return -1
      if (type.is(a.value) && type.is(b.value)) {
        return type.compare(a.value, b.value, column, context.format) * sign
      }
      return groupKeyOf(a.value).localeCompare(groupKeyOf(b.value), context.format.locale) * sign
    })
  }
  return entries.map(([key, bucket]) => ({
    key,
    value: bucket.value,
    rows: bucket.rows,
    aggregates: aggregateRows(bucket.rows, aggregates, schema, context),
  }))
}
