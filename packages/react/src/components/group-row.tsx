import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import {
  isEmptyValue,
  type ColumnLayout,
  type Grid,
  type GroupItem,
  type LayoutColumn,
} from 'tally-core'
import { useView } from '../hooks/use-store.ts'
import { rendererFor } from './cells/renderers.tsx'
import { useShell } from './context.ts'
import { cellStyle, isPinEdge, type PinOffsets } from './geometry.ts'
import { useLabels } from './labels.ts'
import type { ColumnWindow } from './row.tsx'
import { Summary } from './summary.tsx'

interface GroupColumns {
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
}

export interface GroupRowProps {
  readonly grid: Grid
  readonly item: GroupItem
  readonly columns?: GroupColumns | undefined
  readonly style?: CSSProperties | undefined
  readonly rowIndex?: number | undefined
  readonly focusable?: boolean | undefined
}

function GroupLabel({ grid, item }: Pick<GroupRowProps, 'grid' | 'item'>): ReactNode {
  const labels = useLabels()
  const { renderers } = useShell()
  const { column, value } = item
  const type = grid.schema.typeOf(column)
  if (isEmptyValue(value) || !type.is(value)) {
    return <span className="tally-text">{labels.emptyGroup}</span>
  }
  return rendererFor(
    renderers,
    type,
  )({
    value,
    text: type.format(value, column, grid.context.format),
    row: { [column.id]: value },
    column,
    type,
    format: grid.context.format,
  })
}

export function GroupRow({
  grid,
  item,
  columns,
  style,
  rowIndex,
  focusable = true,
}: GroupRowProps): ReactNode {
  const labels = useLabels()
  const footer = useView(grid, (view) => view.footer)
  const toggle = (
    <button
      type="button"
      className="tally-group-toggle"
      aria-label={labels.toggleGroup}
      {...(focusable ? {} : { tabIndex: -1 })}
      aria-expanded={!item.collapsed}
      onClick={() => grid.view.toggleGroupCollapsed(item.key)}
      style={item.collapsed ? undefined : { rotate: '90deg' }}
    >
      <ChevronRight size={14} aria-hidden />
    </button>
  )
  const count = (
    <span className="tally-group-count">
      {item.count.toLocaleString(grid.context.format.locale)}
    </span>
  )
  const label = (
    <span className="tally-group-label">
      <GroupLabel grid={grid} item={item} />
      {count}
    </span>
  )
  if (columns === undefined) {
    return (
      <div className="tally-group" data-plain="" data-group={item.key} style={style}>
        {toggle}
        {label}
      </div>
    )
  }
  const { layout, offsets, window } = columns
  const firstId = layout.columns[0]?.column.id
  const cell = (entry: LayoutColumn): ReactNode => {
    const { column } = entry
    const fn = footer[column.id]
    const summarised = fn !== undefined && fn !== 'count' && column.id !== item.column.id
    return (
      <div
        key={column.id}
        role="gridcell"
        className="tally-group-cell"
        aria-colindex={entry.index + 2}
        data-column={column.id}
        data-align={column.align ?? grid.schema.typeOf(column).align}
        style={cellStyle(entry, offsets)}
        {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
        {...(isPinEdge(entry, layout) ? { 'data-pin-edge': '' } : {})}
      >
        {column.id === firstId ? (
          label
        ) : summarised ? (
          <Summary grid={grid} column={column} fn={fn} aggregates={item.aggregates} />
        ) : null}
      </div>
    )
  }
  return (
    <div
      role="row"
      className="tally-group"
      aria-expanded={!item.collapsed}
      aria-rowindex={rowIndex}
      data-group={item.key}
      style={style}
    >
      <div
        role="gridcell"
        className="tally-gutter"
        aria-colindex={1}
        {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
      >
        {toggle}
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
