import type { CSSProperties, ReactNode, Ref } from 'react'
import type { ColumnLayout, Grid, LayoutColumn, RowItem } from 'tally-core'
import { CellView } from './cell.tsx'
import { isPinEdge, type PinOffsets } from './geometry.ts'
import { ruleFor, type CompiledRule } from './rules.ts'

export interface ColumnWindow {
  readonly columns: readonly LayoutColumn[]
  readonly before: number
  readonly after: number
}

export interface RowViewProps {
  readonly grid: Grid
  readonly item: RowItem
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
  readonly rules: readonly CompiledRule[]
  readonly treeColumn: string | undefined
  readonly wrap: boolean
  readonly selected: boolean
  readonly style?: CSSProperties | undefined
  readonly ref?: Ref<HTMLDivElement> | undefined
  readonly index?: number | undefined
}

export function RowView({
  grid,
  item,
  layout,
  offsets,
  window,
  rules,
  treeColumn,
  wrap,
  selected,
  style,
  ref,
  index,
}: RowViewProps): ReactNode {
  const cell = (entry: LayoutColumn): ReactNode => (
    <CellView
      key={entry.column.id}
      grid={grid}
      item={item}
      entry={entry}
      pinOffset={
        entry.pin === 'left'
          ? offsets.left.get(entry.column.id)
          : entry.pin === 'right'
            ? offsets.right.get(entry.column.id)
            : undefined
      }
      pinEdge={isPinEdge(entry, layout)}
      treeColumn={treeColumn === entry.column.id}
      rule={ruleFor(rules, entry.column.id, item.row)}
    />
  )
  return (
    <div
      ref={ref}
      role="row"
      className="tally-row"
      aria-rowindex={item.index + 2}
      aria-selected={selected}
      data-key={String(item.key)}
      data-index={index}
      style={style}
      {...(wrap ? { 'data-wrap': '' } : {})}
      {...(selected ? { 'data-selected': '' } : {})}
      {...(item.pinned ? { 'data-pinned': '' } : {})}
    >
      <div
        role="rowheader"
        className="tally-gutter"
        {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
      >
        {item.position}
      </div>
      {layout.left.map(cell)}
      {window.before > 0 ? (
        <div className="tally-spacer" style={{ width: window.before }} aria-hidden />
      ) : null}
      {window.columns.map(cell)}
      {window.after > 0 ? (
        <div className="tally-spacer" style={{ width: window.after }} aria-hidden />
      ) : null}
      {layout.right.map(cell)}
    </div>
  )
}
