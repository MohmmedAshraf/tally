import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import {
  columnLabel,
  type ColumnLayout,
  type Grid,
  type LayoutColumn,
  type RowModel,
  type SelectionState,
  type Sort,
} from 'tally-core'
import { useView } from '../hooks/use-store.ts'
import { useColumnDrag, useColumnDropMonitor } from './column-drag.ts'
import { groupSpans, hasColumnGroups, isPinEdge, type PinOffsets } from './geometry.ts'
import { HeaderMenu } from './header-menu.tsx'
import { ResizeHandle } from './resize-handle.tsx'
import type { ColumnWindow } from './row.tsx'

export interface HeaderProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
  readonly model: RowModel
  readonly selection: SelectionState
}

function ariaSort(sort: Sort | undefined): 'ascending' | 'descending' | 'none' {
  if (sort === undefined) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

interface HeaderCellProps {
  readonly grid: Grid
  readonly entry: LayoutColumn
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly sorts: readonly Sort[]
}

function HeaderCell({ grid, entry, layout, offsets, sorts }: HeaderCellProps): ReactNode {
  const { column } = entry
  const element = useRef<HTMLDivElement>(null)
  const { dragging, edge } = useColumnDrag(element, column.id, true)
  const type = grid.schema.typeOf(column)
  const position = sorts.findIndex((sort) => sort.column === column.id)
  const sort = position === -1 ? undefined : sorts[position]
  const sortable = column.sortable !== false
  const pinOffset =
    entry.pin === 'left'
      ? offsets.left.get(column.id)
      : entry.pin === 'right'
        ? offsets.right.get(column.id)
        : undefined
  const style: CSSProperties = { width: entry.width }
  if (pinOffset !== undefined) style['--tally-pin-offset'] = `${pinOffset}px`
  const onSort = (event: MouseEvent): void => grid.view.toggleSort(column.id, event.shiftKey)
  return (
    <div
      ref={element}
      role="columnheader"
      className="tally-header-cell"
      aria-colindex={entry.index + 2}
      aria-sort={ariaSort(sort)}
      data-column={column.id}
      data-align={column.align ?? type.align}
      style={style}
      {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
      {...(isPinEdge(entry, layout) ? { 'data-pin-edge': '' } : {})}
      {...(sort === undefined ? {} : { 'data-sorted': sort.direction })}
      {...(dragging ? { 'data-dragging': '' } : {})}
      {...(edge === undefined ? {} : { 'data-drop-edge': edge })}
    >
      {sortable ? (
        <button type="button" className="tally-header-label" onClick={onSort}>
          <span className="tally-text">{columnLabel(column)}</span>
          {sort === undefined ? null : (
            <span className="tally-sort-glyph" aria-hidden>
              <i>
                <ChevronUp
                  size={10}
                  strokeWidth={2.5}
                  {...(sort.direction === 'asc' ? { 'data-on': '' } : {})}
                />
                <ChevronDown
                  size={10}
                  strokeWidth={2.5}
                  {...(sort.direction === 'desc' ? { 'data-on': '' } : {})}
                />
              </i>
              {sorts.length > 1 ? <b>{position + 1}</b> : null}
            </span>
          )}
        </button>
      ) : (
        <span className="tally-text">{columnLabel(column)}</span>
      )}
      <HeaderMenu grid={grid} entry={entry} anchor={element} />
      <ResizeHandle grid={grid} entry={entry} />
    </div>
  )
}

export function Header({
  grid,
  layout,
  offsets,
  window,
  model,
  selection,
}: HeaderProps): ReactNode {
  const sorts = useView(grid, (view) => view.sort)
  useColumnDropMonitor(grid)
  const selectedCount = model.rows.filter((item) => selection.rows.has(item.key)).length
  const allSelected = model.rows.length > 0 && selectedCount === model.rows.length
  const toggleAll = (): void => {
    if (selectedCount > 0) grid.selection.dispatch({ type: 'clearRows' })
    else grid.selection.dispatch({ type: 'selectRows', keys: model.rows.map((item) => item.key) })
  }
  const cell = (entry: LayoutColumn): ReactNode => (
    <HeaderCell
      key={entry.column.id}
      grid={grid}
      entry={entry}
      layout={layout}
      offsets={offsets}
      sorts={sorts}
    />
  )
  return (
    <div className="tally-header">
      {hasColumnGroups(layout) ? (
        <div className="tally-band" aria-hidden>
          <div className="tally-band-cell" style={{ width: offsets.leftWidth + 44 }} />
          {groupSpans(layout.center).map((span) => (
            <div
              key={span.key}
              className="tally-band-cell"
              style={{ width: span.width }}
              {...(span.label === undefined ? {} : { 'data-group': '' })}
            >
              {span.label}
            </div>
          ))}
        </div>
      ) : null}
      <div role="row" className="tally-header-row" aria-rowindex={1}>
        <div
          role="columnheader"
          className="tally-gutter"
          aria-colindex={1}
          {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
        >
          <input
            type="checkbox"
            className="tally-check"
            aria-label="Select all rows"
            checked={allSelected}
            ref={(input) => {
              if (input !== null) input.indeterminate = selectedCount > 0 && !allSelected
            }}
            onChange={toggleAll}
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
    </div>
  )
}
