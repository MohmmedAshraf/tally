import type { ReactNode } from 'react'
import {
  optionLabel,
  type Column,
  type ColumnLayout,
  type EnumOption,
  type Facet,
  type Grid,
  type LayoutColumn,
} from 'tally-core'
import { useGridState, useView } from '../hooks/use-store.ts'
import { useLabels } from './labels.ts'

interface Segment {
  readonly value: string
  readonly label: string
  readonly count: number
  readonly color: string
}

function segmentsOf(column: Column, facet: Facet | undefined): readonly Segment[] {
  if (facet?.kind !== 'terms') return []
  const counts = new Map(facet.terms.map((term) => [String(term.value), term.count]))
  const options: readonly EnumOption[] =
    column.options ?? facet.terms.map((term) => ({ value: String(term.value) }))
  return options
    .map((option, index) => ({
      value: option.value,
      label: optionLabel(column, option.value),
      count: counts.get(option.value) ?? 0,
      color:
        option.color ??
        `color-mix(in oklch, var(--tally-ink-3) ${Math.max(15, 70 - index * 15)}%, var(--tally-line))`,
    }))
    .filter((segment) => segment.count > 0)
}

function Distribution({
  segments,
  locale,
}: {
  readonly segments: readonly Segment[]
  readonly locale: string
}): ReactNode {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const summary = segments
    .map((segment) => `${segment.label} ${segment.count.toLocaleString(locale)}`)
    .join(' · ')
  return (
    <span className="tally-distribution" role="img" aria-label={summary} title={summary}>
      {segments.map((segment) => (
        <i
          key={segment.value}
          style={{ flexGrow: segment.count / total, background: segment.color }}
        />
      ))}
    </span>
  )
}
import { cellStyle, isPinEdge, type PinOffsets } from './geometry.ts'
import type { ColumnWindow } from './row.tsx'
import { Summary } from './summary.tsx'

export interface FooterProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
  readonly visible: { readonly from: number; readonly to: number } | undefined
  readonly rowIndex?: number | undefined
}

export function Footer({
  grid,
  layout,
  offsets,
  window,
  visible,
  rowIndex,
}: FooterProps): ReactNode {
  const labels = useLabels()
  const footer = useView(grid, (view) => view.footer)
  const state = useGridState(grid)
  const locale = grid.context.format.locale
  const total = state.matched ?? state.total
  const cell = (entry: LayoutColumn, first: boolean): ReactNode => {
    const { column } = entry
    const type = grid.schema.typeOf(column)
    const fn = footer[column.id]
    let content: ReactNode = null
    const segments =
      fn === 'count' && (type.kind === 'enum' || type.kind === 'boolean')
        ? segmentsOf(column, state.facets?.[column.id])
        : []
    if (segments.length > 0) {
      content = <Distribution segments={segments} locale={locale} />
    } else if (fn !== undefined) {
      content = <Summary grid={grid} column={column} fn={fn} aggregates={state.aggregates} />
    } else if (first && total !== undefined) {
      content = (
        <span className="tally-summary-value">
          {visible === undefined
            ? total.toLocaleString(locale)
            : `${visible.from.toLocaleString(locale)}–${visible.to.toLocaleString(locale)} / ${total.toLocaleString(locale)}`}
        </span>
      )
    }
    return (
      <div
        key={column.id}
        role="gridcell"
        className="tally-footer-cell"
        aria-colindex={entry.index + 2}
        data-column={column.id}
        data-align={column.align ?? type.align}
        style={cellStyle(entry, offsets)}
        {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
        {...(isPinEdge(entry, layout) ? { 'data-pin-edge': '' } : {})}
      >
        {content}
      </div>
    )
  }
  const firstId = layout.columns[0]?.column.id
  return (
    <div className="tally-footer" role="rowgroup">
      <div
        role="row"
        className="tally-footer-row"
        aria-label={labels.footer}
        aria-rowindex={rowIndex}
      >
        <div
          role="gridcell"
          className="tally-gutter"
          aria-colindex={1}
          {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
        />
        {layout.left.map((entry) => cell(entry, entry.column.id === firstId))}
        {window.before > 0 ? (
          <div className="tally-spacer" style={{ width: window.before }} aria-hidden />
        ) : null}
        {window.columns.map((entry) => cell(entry, entry.column.id === firstId))}
        {window.after > 0 ? (
          <div className="tally-spacer" style={{ width: window.after }} aria-hidden />
        ) : null}
        {layout.right.map((entry) => cell(entry, entry.column.id === firstId))}
      </div>
    </div>
  )
}
