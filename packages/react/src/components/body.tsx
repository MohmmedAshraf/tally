import { useVirtualizer, type Range } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import type { ColumnLayout, Grid, RowModel } from 'tally-core'
import { useRowModel, useSelection, useView } from '../hooks/use-store.ts'
import { useShell } from './context.ts'
import { Footer } from './footer.tsx'
import { GROUP_HEIGHT, GUTTER_WIDTH, ROW_HEIGHT, hasWrap, pinOffsets } from './geometry.ts'
import { GroupRow } from './group-row.tsx'
import { Header } from './header.tsx'
import { RowView, type ColumnWindow } from './row.tsx'
import { useCompiledRules } from './rules.ts'

export interface BodyProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly initialSize: { readonly width: number; readonly height: number } | undefined
}

function useOffsetTop(element: HTMLElement | null): number {
  const [offset, setOffset] = useState(0)
  useLayoutEffect(() => {
    if (element === null) return
    const measure = (): void => setOffset(element.offsetTop)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    let sibling = element.previousElementSibling
    while (sibling !== null) {
      observer.observe(sibling)
      sibling = sibling.previousElementSibling
    }
    return () => observer.disconnect()
  }, [element])
  return offset
}

function bodyItems(model: RowModel): RowModel['items'] {
  return model.items.filter((item) => item.kind === 'group' || !item.pinned)
}

export function Body({ grid, layout, initialSize }: BodyProps): ReactNode {
  const { viewport } = useShell()
  const model = useRowModel(grid)
  const selection = useSelection(grid)
  const density = useView(grid, (view) => view.density)
  const rules = useView(grid, (view) => view.rules)
  const compiledRules = useCompiledRules(grid, rules)
  const offsets = useMemo(() => pinOffsets(layout), [layout])
  const wrap = hasWrap(layout)
  const rowHeight = ROW_HEIGHT[density]
  const items = useMemo(() => bodyItems(model), [model])
  const [bodyElement, setBodyElement] = useState<HTMLDivElement | null>(null)
  const scrollMargin = useOffsetTop(bodyElement)
  const treeColumn = grid.schema.hierarchical ? layout.columns[0]?.column.id : undefined

  const rows = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewport.current,
    estimateSize: (index) => (items[index]?.kind === 'group' ? GROUP_HEIGHT : rowHeight),
    overscan: 6,
    scrollMargin,
    ...(initialSize === undefined ? {} : { initialRect: initialSize }),
    getItemKey: (index) => {
      const item = items[index]
      return item === undefined ? index : item.kind === 'group' ? `g:${item.key}` : item.key
    },
  })
  const rangeExtractor = useCallback((range: Range): number[] => {
    const start = Math.max(0, range.startIndex - range.overscan)
    const end = Math.min(range.count - 1, range.endIndex + range.overscan)
    const indexes: number[] = []
    for (let index = start; index <= end; index += 1) indexes.push(index)
    return indexes
  }, [])
  const columns = useVirtualizer({
    horizontal: true,
    count: layout.center.length,
    getScrollElement: () => viewport.current,
    estimateSize: (index) => layout.center[index]?.width ?? 160,
    overscan: 2,
    scrollMargin: GUTTER_WIDTH + offsets.leftWidth,
    ...(initialSize === undefined ? {} : { initialRect: initialSize }),
    rangeExtractor,
    getItemKey: (index) => layout.center[index]?.column.id ?? index,
  })

  const virtualColumns = columns.getVirtualItems()
  const firstColumn = virtualColumns[0]
  const lastColumn = virtualColumns.at(-1)
  const window: ColumnWindow = {
    columns: virtualColumns.flatMap((item) => {
      const entry = layout.center[item.index]
      return entry === undefined ? [] : [entry]
    }),
    before: firstColumn === undefined ? 0 : firstColumn.start - columns.options.scrollMargin,
    after:
      lastColumn === undefined
        ? 0
        : offsets.centerWidth - (lastColumn.end - columns.options.scrollMargin),
  }

  const virtualRows = rows.getVirtualItems()
  const visibleRows = virtualRows
    .map((virtual) => items[virtual.index])
    .filter((item) => item !== undefined && item.kind === 'row')
  const first = visibleRows[0]
  const last = visibleRows.at(-1)
  const visible =
    first !== undefined && last !== undefined
      ? { from: first.index + 1, to: last.index + 1 }
      : undefined
  const currentGroup = (() => {
    const head = virtualRows.find(
      (virtual) => virtual.start >= scrollMargin + (viewport.current?.scrollTop ?? 0) - 1,
    )
    const item = head === undefined ? undefined : items[head.index]
    if (item === undefined || item.kind !== 'row' || item.group === undefined) return undefined
    const group = model.groups.find((candidate) => candidate.key === item.group)
    return group !== undefined && !group.collapsed ? group : undefined
  })()

  const headerOffset = `${scrollMargin - model.pinned.length * rowHeight}px`
  const totalWidth = `${GUTTER_WIDTH + layout.totalWidth}px`

  return (
    <div
      style={{ '--tally-total-width': totalWidth, '--tally-header-offset': headerOffset }}
      className="tally-sheet"
    >
      <Header grid={grid} layout={layout} offsets={offsets} window={window} />
      {model.pinned.length > 0 ? (
        <div className="tally-pinned-rows" role="rowgroup">
          {model.pinned.map((item) => (
            <RowView
              key={item.key}
              grid={grid}
              item={item}
              layout={layout}
              offsets={offsets}
              window={window}
              rules={compiledRules}
              treeColumn={treeColumn}
              wrap={false}
              selected={selection.rows.has(item.key)}
            />
          ))}
        </div>
      ) : null}
      {currentGroup === undefined ? null : (
        <div className="tally-group-sticky" aria-hidden>
          <GroupRow grid={grid} item={currentGroup} />
        </div>
      )}
      <div
        ref={setBodyElement}
        role="rowgroup"
        className="tally-body"
        style={{ height: rows.getTotalSize() }}
      >
        {virtualRows.map((virtual) => {
          const item = items[virtual.index]
          if (item === undefined) return null
          const style = {
            transform: `translateY(${virtual.start - rows.options.scrollMargin}px)`,
          }
          if (item.kind === 'group') {
            return <GroupRow key={virtual.key} grid={grid} item={item} style={style} />
          }
          return (
            <RowView
              key={virtual.key}
              ref={wrap ? rows.measureElement : undefined}
              index={virtual.index}
              grid={grid}
              item={item}
              layout={layout}
              offsets={offsets}
              window={window}
              rules={compiledRules}
              treeColumn={treeColumn}
              wrap={wrap}
              selected={selection.rows.has(item.key)}
              style={style}
            />
          )
        })}
      </div>
      <Footer grid={grid} layout={layout} offsets={offsets} window={window} visible={visible} />
    </div>
  )
}
