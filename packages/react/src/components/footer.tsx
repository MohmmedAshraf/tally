import type { CSSProperties, ReactNode } from 'react'
import { aggregateKey, type ColumnLayout, type Grid, type LayoutColumn } from 'tally-core'
import { useGridState, useView } from '../hooks/use-store.ts'
import { aggregateLabel, dateFooter, formatAggregate, isDateRangeFooter } from './format.ts'
import { isPinEdge, type PinOffsets } from './geometry.ts'
import type { ColumnWindow } from './row.tsx'

export interface FooterProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
  readonly visible: { readonly from: number; readonly to: number } | undefined
}

export function Footer({ grid, layout, offsets, window, visible }: FooterProps): ReactNode {
  const footer = useView(grid, (view) => view.footer)
  const state = useGridState(grid)
  const locale = grid.context.format.locale
  const total = state.matched ?? state.total
  const cell = (entry: LayoutColumn, first: boolean): ReactNode => {
    const { column } = entry
    const type = grid.schema.typeOf(column)
    const fn = footer[column.id]
    const pinOffset =
      entry.pin === 'left'
        ? offsets.left.get(column.id)
        : entry.pin === 'right'
          ? offsets.right.get(column.id)
          : undefined
    const style: CSSProperties = { width: entry.width }
    if (pinOffset !== undefined) style['--tally-pin-offset'] = `${pinOffset}px`
    let content: ReactNode = null
    if (fn !== undefined) {
      const range = isDateRangeFooter(grid, column, fn) ? dateFooter(grid, column) : undefined
      const value = state.aggregates?.[aggregateKey({ column: column.id, fn })]
      if (range !== undefined) {
        content = (
          <span className="tally-footer-value" title={range.title}>
            {range.text}
          </span>
        )
      } else if (value !== undefined) {
        content = (
          <>
            <span className="tally-footer-label">{aggregateLabel(fn)}</span>
            <span className="tally-footer-value">{formatAggregate(grid, column, fn, value)}</span>
          </>
        )
      }
    } else if (first && total !== undefined) {
      content = (
        <span className="tally-footer-value">
          {visible === undefined
            ? total.toLocaleString(locale)
            : `${visible.from.toLocaleString(locale)}–${visible.to.toLocaleString(locale)} / ${total.toLocaleString(locale)}`}
        </span>
      )
    }
    return (
      <div
        key={column.id}
        className="tally-footer-cell"
        data-column={column.id}
        data-align={column.align ?? type.align}
        style={style}
        {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
        {...(isPinEdge(entry, layout) ? { 'data-pin-edge': '' } : {})}
      >
        {content}
      </div>
    )
  }
  const firstId = layout.columns[0]?.column.id
  return (
    <div className="tally-footer" aria-hidden>
      <div className="tally-footer-row">
        <div
          className="tally-gutter"
          {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
        >
          Σ
        </div>
        {layout.left.map((entry) => cell(entry, entry.column.id === firstId))}
        {window.before > 0 ? (
          <div className="tally-spacer" style={{ width: window.before }} />
        ) : null}
        {window.columns.map((entry) => cell(entry, entry.column.id === firstId))}
        {window.after > 0 ? <div className="tally-spacer" style={{ width: window.after }} /> : null}
        {layout.right.map((entry) => cell(entry, entry.column.id === firstId))}
      </div>
    </div>
  )
}
