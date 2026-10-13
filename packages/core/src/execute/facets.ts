import { dateFromDayNumber, dayNumber, isIsoDate } from '../format/date.ts'
import type { RowData } from '../rows/row.ts'
import type { Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import { isEmptyValue } from '../types/column-type.ts'
import type { ExecutionContext } from './context.ts'

export interface HistogramBin {
  readonly start: unknown
  readonly end: unknown
  readonly count: number
}

export interface HistogramFacet {
  readonly kind: 'histogram'
  readonly min: unknown
  readonly max: unknown
  readonly bins: readonly HistogramBin[]
}

export interface TermCount {
  readonly value: unknown
  readonly count: number
}

export interface TermsFacet {
  readonly kind: 'terms'
  readonly terms: readonly TermCount[]
  readonly distinct: number
}

export type Facet = HistogramFacet | TermsFacet

export type Facets = Readonly<Record<string, Facet>>

export interface FacetOptions {
  readonly bins?: number | undefined
  readonly maxTerms?: number | undefined
}

function numericValue(value: unknown, kind: 'number' | 'date'): number | undefined {
  if (kind === 'number')
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  return typeof value === 'string' && isIsoDate(value) ? dayNumber(value) : undefined
}

function fromNumeric(value: number, kind: 'number' | 'date'): unknown {
  return kind === 'number' ? value : dateFromDayNumber(Math.round(value))
}

export function histogram(
  values: readonly unknown[],
  kind: 'number' | 'date',
  bins: number,
): HistogramFacet {
  const numbers: number[] = []
  for (const value of values) {
    const numeric = numericValue(value, kind)
    if (numeric !== undefined) numbers.push(numeric)
  }
  if (numbers.length === 0) return { kind: 'histogram', min: undefined, max: undefined, bins: [] }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of numbers) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const span = max === min ? 1 : max - min
  const step = span / bins
  const counts = Array.from({ length: bins }, () => 0)
  for (const value of numbers) {
    const index = Math.min(bins - 1, Math.floor((value - min) / step))
    counts[index] = (counts[index] ?? 0) + 1
  }
  return {
    kind: 'histogram',
    min: fromNumeric(min, kind),
    max: fromNumeric(max, kind),
    bins: counts.map((count, index) => ({
      start: fromNumeric(min + index * step, kind),
      end: fromNumeric(min + (index + 1) * step, kind),
      count,
    })),
  }
}

export function terms(
  values: readonly unknown[],
  column: Column,
  schema: Schema,
  context: ExecutionContext,
  maxTerms: number,
): TermsFacet {
  const type = schema.typeOf(column)
  const counts = new Map<unknown, number>()
  for (const value of values) {
    if (isEmptyValue(value)) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const ordered = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .toSorted((a, b) => {
      if (type.is(a.value) && type.is(b.value)) {
        const order = type.compare(a.value, b.value, column, context.format)
        if (column.options !== undefined && order !== 0) return order
      }
      return b.count - a.count
    })
  return { kind: 'terms', terms: ordered.slice(0, maxTerms), distinct: counts.size }
}

export function computeFacets(
  rows: readonly RowData[],
  columnIds: readonly string[],
  schema: Schema,
  context: ExecutionContext,
  options: FacetOptions = {},
): Facets {
  const bins = options.bins ?? 20
  const maxTerms = options.maxTerms ?? 50
  const facets: Record<string, Facet> = {}
  for (const id of columnIds) {
    const column = schema.column(id)
    if (column === undefined) continue
    const type = schema.typeOf(column)
    const values = rows.map((row) => schema.valueOf(row, column))
    if (type.facet === 'histogram' && (type.kind === 'number' || type.kind === 'date')) {
      facets[id] = histogram(values, type.kind, bins)
    } else if (type.facet === 'terms') {
      facets[id] = terms(values, column, schema, context, maxTerms)
    }
  }
  return facets
}
