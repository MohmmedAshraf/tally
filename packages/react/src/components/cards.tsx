import { useVirtualizer } from '@tanstack/react-virtual'
import { createElement, useMemo, useRef, type ReactNode } from 'react'
import {
  columnLabel,
  isEmptyValue,
  type CardRole,
  type Column,
  type ColumnLayout,
  type Grid,
  type RowData,
  type RowItem,
} from 'tally-core'
import { useColumnLayout, useRowModel, useSelection } from '../hooks/use-store.ts'
import { Tile, rendererFor, signOf, subtitleOf } from './cells/renderers.tsx'
import { useShell } from './context.ts'
import { GroupRow } from './group-row.tsx'
import { useLabels } from './labels.ts'

interface CardLayout {
  readonly title: Column | undefined
  readonly badges: readonly Column[]
  readonly metrics: readonly Column[]
  readonly meta: readonly Column[]
}

function roleOf(grid: Grid, column: Column): CardRole {
  return column.card ?? grid.schema.typeOf(column).card
}

function cardLayout(grid: Grid, columns: ColumnLayout): CardLayout {
  const visible = columns.columns.map((entry) => entry.column)
  const byRole = (role: CardRole): Column[] =>
    visible.filter((column) => roleOf(grid, column) === role)
  const titled = byRole('title')
  return {
    title: titled[0] ?? visible[0],
    badges: byRole('badge'),
    metrics: byRole('metric'),
    meta: [...titled.slice(1), ...byRole('meta')],
  }
}

function textOf(grid: Grid, row: RowData, column: Column): string {
  const type = grid.schema.typeOf(column)
  const value = grid.schema.valueOf(row, column)
  return isEmptyValue(value) || !type.is(value)
    ? ''
    : type.format(value, column, grid.context.format)
}

function signAttr(grid: Grid, row: RowData, column: Column): { readonly 'data-sign'?: string } {
  const sign = signOf(grid.schema.typeOf(column).name, grid.schema.valueOf(row, column))
  return sign === undefined ? {} : { 'data-sign': sign }
}

function CardValue({
  grid,
  item,
  column,
}: {
  readonly grid: Grid
  readonly item: RowItem
  readonly column: Column
}): ReactNode {
  const { renderers } = useShell()
  const type = grid.schema.typeOf(column)
  const value = grid.schema.valueOf(item.row, column)
  const text = textOf(grid, item.row, column)
  return createElement(rendererFor(renderers, type), {
    value,
    text,
    row: item.row,
    column,
    type,
    format: grid.context.format,
  })
}

function Card({
  grid,
  item,
  layout,
}: {
  readonly grid: Grid
  readonly item: RowItem
  readonly layout: CardLayout
}): ReactNode {
  const labels = useLabels()
  const selection = useSelection(grid)
  const selected = selection.rows.has(item.key)
  const title = layout.title === undefined ? '' : textOf(grid, item.row, layout.title)
  const subtitle = layout.title === undefined ? undefined : subtitleOf(item.row, layout.title)
  return (
    <article
      className="tally-card"
      aria-label={title}
      {...(selected ? { 'data-selected': '' } : {})}
    >
      <header className="tally-card-head">
        {layout.title?.avatar === true && title !== '' ? <Tile text={title} /> : null}
        <span className="tally-card-title">
          <span className="tally-text">{title}</span>
          {subtitle === undefined ? null : <span className="tally-sub">{subtitle}</span>}
        </span>
        <input
          type="checkbox"
          className="tally-check"
          aria-label={labels.selectRow(title)}
          checked={selected}
          onChange={() =>
            grid.selection.dispatch({ type: 'selectRow', index: item.index, mode: 'toggle' })
          }
        />
      </header>
      {layout.badges.length > 0 ? (
        <div className="tally-card-badges">
          {layout.badges.map((column) => (
            <CardValue key={column.id} grid={grid} item={item} column={column} />
          ))}
        </div>
      ) : null}
      {layout.metrics.length > 0 ? (
        <dl className="tally-card-metrics">
          {layout.metrics.map((column) => (
            <div
              key={column.id}
              className="tally-card-metric"
              {...signAttr(grid, item.row, column)}
            >
              <dt>{columnLabel(column)}</dt>
              <dd>
                <CardValue grid={grid} item={item} column={column} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {layout.meta.length > 0 ? (
        <div className="tally-card-meta">
          {layout.meta.map((column) => (
            <span key={column.id} className="tally-card-meta-item">
              <CardValue grid={grid} item={item} column={column} />
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function Cards({ grid }: { readonly grid: Grid }): ReactNode {
  const { viewport } = useShell()
  const model = useRowModel(grid)
  const columns = useColumnLayout(grid)
  const layout = useMemo(() => cardLayout(grid, columns), [grid, columns])
  const items = model.items
  const list = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewport.current,
    estimateSize: (index) => (items[index]?.kind === 'group' ? 44 : 150),
    overscan: 4,
    getItemKey: (index) => {
      const item = items[index]
      return item === undefined ? index : item.kind === 'group' ? `g:${item.key}` : item.key
    },
  })
  return (
    <div ref={list} className="tally-cards" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtual) => {
        const item = items[virtual.index]
        if (item === undefined) return null
        return (
          <div
            key={virtual.key}
            ref={virtualizer.measureElement}
            data-index={virtual.index}
            className="tally-card-slot"
            style={{ transform: `translateY(${virtual.start}px)` }}
          >
            {item.kind === 'group' ? (
              <GroupRow grid={grid} item={item} />
            ) : (
              <Card grid={grid} item={item} layout={layout} />
            )}
          </div>
        )
      })}
    </div>
  )
}
