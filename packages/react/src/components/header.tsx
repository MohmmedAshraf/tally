import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { columnLabel, type ColumnLayout, type Grid, type LayoutColumn, type Sort } from 'tally-core'
import { useView } from '../hooks/use-store.ts'
import { groupSpans, hasColumnGroups, isPinEdge, type PinOffsets } from './geometry.ts'
import type { ColumnWindow } from './row.tsx'

export interface HeaderProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
}

function sortGlyph(sort: Sort | undefined, count: number, position: number): string {
  if (sort === undefined) return ''
  const arrow = sort.direction === 'asc' ? '↑' : '↓'
  return count > 1 ? `${arrow}${position + 1}` : arrow
}

function ariaSort(sort: Sort | undefined): 'ascending' | 'descending' | 'none' {
  if (sort === undefined) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

export function Header({ grid, layout, offsets, window }: HeaderProps): ReactNode {
  const sorts = useView(grid, (view) => view.sort)
  const cell = (entry: LayoutColumn): ReactNode => {
    const { column } = entry
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
        key={column.id}
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
      >
        {sortable ? (
          <button type="button" className="tally-header-label" onClick={onSort}>
            <span className="tally-text">{columnLabel(column)}</span>
            {sort === undefined ? null : (
              <span className="tally-sort-glyph" aria-hidden>
                {sortGlyph(sort, sorts.length, position)}
              </span>
            )}
          </button>
        ) : (
          <span className="tally-text">{columnLabel(column)}</span>
        )}
      </div>
    )
  }
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
        />
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
