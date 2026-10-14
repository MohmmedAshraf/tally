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
  return (
    <span
      className="tally-distribution"
      title={segments
        .map((segment) => `${segment.label} ${segment.count.toLocaleString(locale)}`)
        .join(' · ')}
    >
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
        className="tally-footer-cell"
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
    <div className="tally-footer" aria-hidden>
      <div className="tally-footer-row">
        <div
          className="tally-gutter"
          {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
        />
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
