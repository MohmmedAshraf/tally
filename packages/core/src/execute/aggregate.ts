import type { RowData } from '../rows/row.ts'
import type { Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import type { AggregateName } from '../types/aggregate.ts'
import { isEmptyValue } from '../types/column-type.ts'
import type { ExecutionContext } from './context.ts'

export interface AggregateRequest {
  readonly column: string
  readonly fn: AggregateName
}

export type AggregateResults = Readonly<Record<string, unknown>>

export function aggregateKey(request: AggregateRequest): string {
  return `${request.column}:${request.fn}`
}

export function aggregateValues(
  values: readonly unknown[],
  fn: AggregateName,
  column: Column,
  schema: Schema,
  context: ExecutionContext,
): unknown {
  const type = schema.typeOf(column)
  const present = values.filter((value) => !isEmptyValue(value) && type.is(value))
  switch (fn) {
    case 'count':
      return present.length
    case 'distinct':
      return new Set(
        present.map((value) => (typeof value === 'object' ? JSON.stringify(value) : value)),
      ).size
    case 'sum': {
      let total = 0
      for (const value of present) if (typeof value === 'number') total += value
      return total
    }
    case 'avg': {
      const numbers = present.filter((value): value is number => typeof value === 'number')
      if (numbers.length === 0) return undefined
      return numbers.reduce((total, value) => total + value, 0) / numbers.length
    }
    case 'min':
    case 'max': {
      let best: unknown
      for (const value of present) {
        if (best === undefined) {
          best = value
          continue
        }
        const order = type.compare(value, best, column, context.format)
        if (fn === 'min' ? order < 0 : order > 0) best = value
      }
      return best
    }
  }
}

export function aggregateRows(
  rows: readonly RowData[],
  requests: readonly AggregateRequest[],
  schema: Schema,
  context: ExecutionContext,
): AggregateResults {
  const results: Record<string, unknown> = {}
  for (const request of requests) {
    const column = schema.column(request.column)
    if (column === undefined) continue
    const type = schema.typeOf(column)
    if (!type.aggregates.includes(request.fn)) continue
    const values = rows.map((row) => schema.valueOf(row, column))
    results[aggregateKey(request)] = aggregateValues(values, request.fn, column, schema, context)
  }
  return results
}
