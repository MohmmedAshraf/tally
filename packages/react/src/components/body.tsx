import { useVirtualizer, type Range } from '@tanstack/react-virtual'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ColumnLayout, Grid, RowModel } from 'tally-core'
import { useGridState, useRowModel, useSelection, useView } from '../hooks/use-store.ts'
import { useShell } from './context.ts'
import { Footer } from './footer.tsx'
import { GROUP_HEIGHT, GUTTER_WIDTH, ROW_HEIGHT, hasWrap, pinOffsets } from './geometry.ts'
import { GroupRow } from './group-row.tsx'
import { NewRow } from './new-row.tsx'
import { RowMenu } from './row-menu.tsx'
import { Header } from './header.tsx'
import { useEditing, useFill } from './editing.ts'
import { useInteractions, type IntentHandler } from './interactions.ts'
import { RowView, type ColumnWindow } from './row.tsx'
import { useCompiledRules } from './rules.ts'

export interface BodyProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly initialSize: { readonly width: number; readonly height: number } | undefined
  readonly onIntent: IntentHandler | undefined
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

export function Body({ grid, layout, initialSize, onIntent }: BodyProps): ReactNode {
  const id = useId()
  const cellId = useCallback(
    (row: number, column: number): string => `${id}r${row}c${column}`,
    [id],
  )
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
    scrollPaddingStart: model.pinned.length * rowHeight,
    scrollPaddingEnd: 38,
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

  const { editors, filterInput } = useShell()
  const edit = useEditing({ grid, viewport, layout, model, editors })
  const filling = useFill(grid, layout, model)
  useInteractions({
    grid,
    viewport,
    layout,
    model,
    items,
    rows,
    columns,
    pageSize: Math.max(
      1,
      Math.floor(((rows.scrollRect?.height ?? 0) - scrollMargin) / rowHeight) - 1,
    ),
    onIntent,
    editing: edit.api,
    fill: filling.api,
    focusFilter: () => filterInput.current?.focus(),
  })
  const editingFor = (row: number): { column: number; node: ReactNode } | undefined =>
    edit.editing?.cell.row === row
      ? { column: edit.editing.cell.column, node: edit.editor }
      : undefined
  const activeId =
    selection.active === undefined
      ? undefined
      : cellId(selection.active.row, selection.active.column)
  useLayoutEffect(() => {
    const element = viewport.current
    if (element === null) return
    if (activeId === undefined) element.removeAttribute('aria-activedescendant')
    else element.setAttribute('aria-activedescendant', activeId)
  }, [viewport, activeId])
  const status = useGridState(grid, (state) => state.status)
  const exhausted = useGridState(grid, (state) => state.exhausted)
  const virtualRows = rows.getVirtualItems()
  const lastVirtualIndex = virtualRows.at(-1)?.index ?? -1
  useEffect(() => {
    if (grid.capabilities.pagination !== 'cursor' || exhausted || status !== 'ready') return
    if (lastVirtualIndex >= items.length - 12) void grid.loadMore()
  }, [grid, exhausted, status, lastVirtualIndex, items.length])
  const visibleRows = virtualRows
    .map((virtual) => items[virtual.index])
    .filter((item) => item !== undefined && item.kind === 'row')
  const first = visibleRows[0]
  const last = visibleRows.at(-1)
  const page = useGridState(grid, (state) => state.page)
  const pageOffset = grid.capabilities.pagination === 'offset' ? page.index * page.size : 0
  const visible =
    first !== undefined && last !== undefined
      ? { from: pageOffset + first.index + 1, to: pageOffset + last.index + 1 }
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
    <RowMenu grid={grid}>
      <div
        style={{ '--tally-total-width': totalWidth, '--tally-header-offset': headerOffset }}
        className="tally-sheet"
      >
        <Header
          grid={grid}
          layout={layout}
          offsets={offsets}
          window={window}
          model={model}
          selection={selection}
        />
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
                selection={selection}
                fill={filling.fill}
                editing={editingFor(item.index)}
                cellId={cellId}
              />
            ))}
          </div>
        ) : null}
        {currentGroup === undefined ? null : (
          <div className="tally-group-sticky" aria-hidden>
            <GroupRow grid={grid} item={currentGroup} columns={{ layout, offsets, window }} />
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
              return (
                <GroupRow
                  key={virtual.key}
                  grid={grid}
                  item={item}
                  columns={{ layout, offsets, window }}
                  style={style}
                />
              )
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
                selection={selection}
                fill={filling.fill}
                editing={editingFor(item.index)}
                cellId={cellId}
                style={style}
              />
            )
          })}
        </div>
        {grid.capabilities.mutate ? (
          <NewRow
            grid={grid}
            layout={layout}
            offsets={offsets}
            window={window}
            onCreated={(rowIndex, column, move) => {
              grid.selection.dispatch({ type: 'focus', cell: { row: rowIndex, column } })
              if (move === 'right' || move === 'left') {
                const next = column + (move === 'right' ? 1 : -1)
                if (layout.columns[next] !== undefined) {
                  edit.api.start({ row: rowIndex, column: next }, undefined)
                }
              }
            }}
          />
        ) : null}
        <Footer grid={grid} layout={layout} offsets={offsets} window={window} visible={visible} />
      </div>
    </RowMenu>
  )
}
