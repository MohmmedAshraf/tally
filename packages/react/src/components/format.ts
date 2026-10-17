import {
  isIsoDate,
  numberFormatter,
  type AggregateName,
  type AggregateResults,
  type Column,
  type FormatContext,
  type Grid,
} from 'tally-core'

const AGGREGATE_LABELS: Readonly<Record<AggregateName, string>> = {
  sum: 'Sum',
  avg: 'Avg',
  min: 'Min',
  max: 'Max',
  count: 'Count',
  distinct: 'Distinct',
}

export function aggregateLabel(fn: AggregateName): string {
  return AGGREGATE_LABELS[fn]
}

function plainDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function formatDateRange(from: string, to: string, format: FormatContext): string {
  const parts = new Intl.DateTimeFormat(format.locale, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
    numberingSystem: format.numberingSystem,
  }).formatRangeToParts(plainDate(from), plainDate(to))
  const separator = parts.findIndex((part) => part.source === 'endRange') - 1
  return parts
    .map((part, index) => (index === separator ? part.value.trim() || part.value : part.value))
    .join('')
}

export function formatAggregate(
  grid: Grid,
  column: Column,
  fn: AggregateName,
  value: unknown,
): string {
  const { format } = grid.context
  if (fn === 'count' || fn === 'distinct') {
    return typeof value === 'number' ? numberFormatter(format, {}).format(value) : ''
  }
  const type = grid.schema.typeOf(column)
  const compact: Column =
    type.kind === 'number' ? { ...column, format: { ...column.format, compact: true } } : column
  if (type.is(value)) return type.format(value, compact, format)
  if (typeof value === 'number') {
    return numberFormatter(format, { maximumFractionDigits: 2 }).format(value)
  }
  return typeof value === 'string' ? value : ''
}

export function isDateRangeFooter(grid: Grid, column: Column, fn: AggregateName): boolean {
  return grid.schema.typeOf(column).kind === 'date' && (fn === 'min' || fn === 'max')
}

export function dateRange(
  grid: Grid,
  column: Column,
  aggregates: AggregateResults | undefined,
): { readonly text: string; readonly title: string } | undefined {
  const min = aggregates?.[`${column.id}:min`]
  const max = aggregates?.[`${column.id}:max`]
  if (typeof min !== 'string' || typeof max !== 'string' || !isIsoDate(min) || !isIsoDate(max)) {
    return undefined
  }
  const type = grid.schema.typeOf(column)
  const { format } = grid.context
  return {
    text: formatDateRange(min, max, format),
    title: `${type.format(min, column, format)} – ${type.format(max, column, format)}`,
  }
}
