import { Sparkles } from 'lucide-react'
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import {
  columnLabel,
  type ColumnLayout,
  type Filter,
  type Grid,
  type LayoutColumn,
  type RowModel,
  type SelectionState,
  type Sort,
} from 'tally-core'
import { useView } from '../hooks/use-store.ts'
import { useColumnDrag, useColumnDropMonitor } from './column-drag.ts'
import { useShell } from './context.ts'
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

function collectFiltered(filter: Filter | undefined, into: Set<string>): void {
  if (filter === undefined) return
  if ('column' in filter) into.add(filter.column)
  if ('filters' in filter) for (const child of filter.filters) collectFiltered(child, into)
  if ('filter' in filter) collectFiltered(filter.filter, into)
}

interface HeaderCellProps {
  readonly grid: Grid
  readonly entry: LayoutColumn
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly sorts: readonly Sort[]
  readonly filtered: boolean
}

function HeaderCell({ grid, entry, layout, offsets, sorts, filtered }: HeaderCellProps): ReactNode {
  const { column } = entry
  const { entering } = useShell()
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
  const [menuPoint, setMenuPoint] = useState<{ readonly x: number; readonly y: number }>()
  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenuPoint({ x: event.clientX, y: event.clientY })
  }
  return (
    <div
      ref={element}
      role="columnheader"
      className="tally-header-cell"
      aria-colindex={entry.index + 2}
      aria-sort={ariaSort(sort)}
      tabIndex={-1}
      data-column={column.id}
      data-align={column.align ?? type.align}
      style={style}
      onContextMenu={onContextMenu}
      {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
      {...(isPinEdge(entry, layout) ? { 'data-pin-edge': '' } : {})}
      {...(sort === undefined ? {} : { 'data-sorted': sort.direction })}
      {...(dragging ? { 'data-dragging': '' } : {})}
      {...(edge === undefined ? {} : { 'data-drop-edge': edge })}
      {...(column.ai === true ? { 'data-ai': '' } : {})}
      {...(entering === column.id ? { 'data-entering': '' } : {})}
    >
      {column.ai === true ? <Sparkles size={13} className="tally-header-ai" aria-hidden /> : null}
      {sortable ? (
        <button type="button" className="tally-header-label" onClick={onSort}>
          <svg
            className="tally-sort-chevrons"
            width="8"
            height="14"
            viewBox="0 0 8 14"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path
              d="M1.5 5 4 2.5 6.5 5"
              {...(sort?.direction === 'asc' ? { 'data-on': '' } : {})}
            />
            <path
              d="M1.5 9 4 11.5 6.5 9"
              {...(sort?.direction === 'desc' ? { 'data-on': '' } : {})}
            />
          </svg>
          <span className="tally-text">{columnLabel(column)}</span>
          {sort !== undefined && sorts.length > 1 ? (
            <b className="tally-sort-index" aria-hidden>
              {position + 1}
            </b>
          ) : null}
        </button>
      ) : (
        <span className="tally-text">{columnLabel(column)}</span>
      )}
      {filtered ? <i className="tally-header-filtered" aria-hidden /> : null}
      <HeaderMenu
        grid={grid}
        entry={entry}
        anchor={element}
        point={menuPoint}
        onPointClose={() => setMenuPoint(undefined)}
      />
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
  const filter = useView(grid, (view) => view.filter)
  const filtered = new Set<string>()
  collectFiltered(filter, filtered)
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
      filtered={filtered.has(entry.column.id)}
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
