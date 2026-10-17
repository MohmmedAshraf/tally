import { memo, type MouseEvent, type NamedExoticComponent, type ReactNode, type Ref } from 'react'
import {
  normalizeRange,
  type ColumnLayout,
  type Grid,
  type LayoutColumn,
  type NormalizedRange,
  type RowItem,
  type SelectionState,
} from 'tally-core'
import { CellView } from './cell.tsx'
import { isPinEdge, type PinOffsets } from './geometry.ts'
import { isActive, isInRange } from './interactions.ts'
import { useLabels } from './labels.ts'
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
  readonly selection: SelectionState
  readonly fill: NormalizedRange | undefined
  readonly editing: { readonly column: number; readonly node: ReactNode } | undefined
  readonly cellId: (row: number, column: number) => string
  readonly top?: number | undefined
  readonly ref?: Ref<HTMLDivElement> | undefined
  readonly index?: number | undefined
  readonly rowIndex: number
}

export const RowView: NamedExoticComponent<RowViewProps> = memo(function RowView({
  grid,
  item,
  layout,
  offsets,
  window,
  rules,
  treeColumn,
  wrap,
  selection,
  fill,
  editing,
  cellId,
  top,
  ref,
  index,
  rowIndex,
}: RowViewProps): ReactNode {
  const labels = useLabels()
  const selected = selection.rows.has(item.key)
  const box = selection.range === undefined ? undefined : normalizeRange(selection.range)
  const cell = (entry: LayoutColumn): ReactNode => (
    <CellView
      key={entry.column.id}
      id={cellId(item.index, entry.index)}
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
      active={isActive(selection, item.index, entry.index)}
      inRange={isInRange(selection, item.index, entry.index)}
      inFill={
        fill !== undefined &&
        item.index >= fill.top &&
        item.index <= fill.bottom &&
        entry.index >= fill.left &&
        entry.index <= fill.right
      }
      handle={box !== undefined && item.index === box.bottom && entry.index === box.right}
      editor={editing?.column === entry.index ? editing.node : null}
    />
  )
  const onToggle = (event: MouseEvent<HTMLInputElement>): void => {
    grid.selection.dispatch({
      type: 'selectRow',
      index: item.index,
      mode: event.shiftKey ? 'range' : 'toggle',
    })
  }
  return (
    <div
      ref={ref}
      role="row"
      className="tally-row"
      aria-rowindex={rowIndex}
      aria-selected={selected}
      data-key={String(item.key)}
      data-index={index}
      style={
        top === undefined
          ? undefined
          : { transform: `translateY(${top}px)`, '--tally-i': Math.min(index ?? 0, 24) }
      }
      {...(wrap ? { 'data-wrap': '' } : {})}
      {...(selected ? { 'data-selected': '' } : {})}
      {...(item.pinned ? { 'data-pinned': '' } : {})}
    >
      <div
        role="rowheader"
        className="tally-gutter"
        aria-colindex={1}
        {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
      >
        <span className="tally-row-number" aria-hidden>
          {item.position}
        </span>
        <input
          type="checkbox"
          className="tally-check"
          tabIndex={-1}
          aria-label={labels.selectRowAt(item.position)}
          checked={selected}
          onClick={onToggle}
          readOnly
        />
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
})
