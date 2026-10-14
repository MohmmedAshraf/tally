import type { ReactNode } from 'react'
import { aggregateKey, type AggregateName, type Column, type Grid } from 'tally-core'
import { aggregateLabel, dateRange, formatAggregate, isDateRangeFooter } from './format.ts'

export interface SummaryProps {
  readonly grid: Grid
  readonly column: Column
  readonly fn: AggregateName
  readonly aggregates: Readonly<Record<string, unknown>> | undefined
}

export function Summary({ grid, column, fn, aggregates }: SummaryProps): ReactNode {
  const range = isDateRangeFooter(grid, column, fn)
    ? dateRange(grid, column, aggregates)
    : undefined
  if (range !== undefined) {
    return (
      <span className="tally-summary-value" title={range.title}>
        {range.text}
      </span>
    )
  }
  const value = aggregates?.[aggregateKey({ column: column.id, fn })]
  if (value === undefined) return null
  return (
    <>
      <span className="tally-summary-label">{aggregateLabel(fn)}</span>
      <span className="tally-summary-value">{formatAggregate(grid, column, fn, value)}</span>
    </>
  )
}
