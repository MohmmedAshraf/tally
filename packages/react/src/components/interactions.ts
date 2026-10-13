import type { Virtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  isCellInRange,
  keyboardIntent,
  normalizeRange,
  toTsv,
  type CellAddress,
  type ColumnLayout,
  type Grid,
  type GridIntent,
  type RowModel,
  type RowModelItem,
  type SelectionState,
} from 'tally-core'

export type IntentHandler = (intent: GridIntent) => boolean | undefined

export interface InteractionOptions {
  readonly grid: Grid
  readonly viewport: RefObject<HTMLDivElement | null>
  readonly layout: ColumnLayout
  readonly model: RowModel
  readonly items: readonly RowModelItem[]
  readonly rows: Virtualizer<HTMLDivElement, Element>
  readonly columns: Virtualizer<HTMLDivElement, Element>
  readonly pageSize: number
  readonly onIntent: IntentHandler | undefined
}

function cellAddressOf(target: EventTarget | null): CellAddress | undefined {
  if (!(target instanceof Element)) return undefined
  const cell = target.closest<HTMLElement>('[data-row-index][data-col-index]')
  if (cell === null) return undefined
  const row = Number(cell.dataset['rowIndex'])
  const column = Number(cell.dataset['colIndex'])
  return Number.isInteger(row) && Number.isInteger(column) ? { row, column } : undefined
}

function platformOf(): 'mac' | 'other' {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
    ? 'mac'
    : 'other'
}

function selectedRows(grid: Grid, selection: SelectionState, model: RowModel): readonly number[] {
  if (selection.range !== undefined) {
    const box = normalizeRange(selection.range)
    const indexes: number[] = []
    for (let index = box.top; index <= box.bottom; index += 1) indexes.push(index)
    return indexes
  }
  return model.rows.filter((item) => selection.rows.has(item.key)).map((item) => item.index)
}

function copySelection(grid: Grid, layout: ColumnLayout, model: RowModel): string {
  const selection = grid.selection.get()
  const indexes = selectedRows(grid, selection, model)
  const box = selection.range === undefined ? undefined : normalizeRange(selection.range)
  const columns = layout.columns
    .filter((entry) => box === undefined || (entry.index >= box.left && entry.index <= box.right))
    .map((entry) => entry.column)
  const rows = indexes.flatMap((index) => {
    const item = model.rows[index]
    return item === undefined ? [] : [item.row]
  })
  return toTsv(rows, grid.schema, { columns, format: grid.context.format })
}

function clearSelectedCells(grid: Grid, layout: ColumnLayout, model: RowModel): void {
  const selection = grid.selection.get()
  if (selection.range === undefined) return
  const box = normalizeRange(selection.range)
  const edits = []
  for (let row = box.top; row <= box.bottom; row += 1) {
    const item = model.rows[row]
    if (item === undefined) continue
    for (let column = box.left; column <= box.right; column += 1) {
      const entry = layout.columns[column]
      if (entry === undefined || entry.column.editable === false) continue
      edits.push({ key: item.key, column: entry.column.id, value: null })
    }
  }
  void grid.setCells(edits)
}

export function isActive(selection: SelectionState, row: number, column: number): boolean {
  return selection.active?.row === row && selection.active.column === column
}

export function isInRange(selection: SelectionState, row: number, column: number): boolean {
  return isCellInRange({ row, column }, selection.range)
}

export function useInteractions(options: InteractionOptions): void {
  const { grid, viewport, onIntent } = options
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const dragging = useRef(false)

  useEffect(() => {
    const element = viewport.current
    if (element === null) return
    const platform = platformOf()

    const handle = (intent: GridIntent): void => {
      if (onIntent?.(intent) === true) return
      const { layout, model } = latest.current
      switch (intent.type) {
        case 'select':
          grid.selection.dispatch(intent.action)
          return
        case 'copy': {
          const text = copySelection(grid, layout, model)
          if (text !== '') void navigator.clipboard.writeText(text)
          return
        }
        case 'clearCells':
          clearSelectedCells(grid, layout, model)
          return
        case 'undo':
          void grid.undo()
          return
        case 'redo':
          void grid.redo()
          return
        case 'escape':
          grid.selection.dispatch({ type: 'clear' })
          return
        case 'toggleRow': {
          const active = grid.selection.get().active
          if (active !== undefined) {
            grid.selection.dispatch({ type: 'selectRow', index: active.row, mode: 'toggle' })
          }
          return
        }
        case 'expand': {
          const active = grid.selection.get().active
          const item = active === undefined ? undefined : model.rows[active.row]
          if (item?.hasChildren === true) grid.view.setExpanded(item.key, intent.open)
          return
        }
        case 'edit':
        case 'cut':
        case 'paste':
        case 'inspect':
        case 'focusFilter':
        case 'commandPalette':
          return
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if (event.target instanceof HTMLElement && event.target !== element) {
        if (event.target.closest('input, textarea, select, [contenteditable]') !== null) return
      }
      const intent = keyboardIntent(
        {
          key: event.key,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
        },
        grid.selection.get(),
        { ...grid.selection.geometry(), pageSize: latest.current.pageSize },
        { platform },
      )
      if (intent === undefined) return
      if (intent.type === 'edit' && intent.initial !== undefined && onIntent === undefined) return
      event.preventDefault()
      handle(intent)
    }

    const onMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) return
      const cell = cellAddressOf(event.target)
      if (cell === undefined) return
      if (event.target instanceof Element && event.target.closest('a, button, input') !== null) {
        return
      }
      event.preventDefault()
      element.focus({ preventScroll: true })
      dragging.current = true
      grid.selection.dispatch({ type: 'focus', cell, extend: event.shiftKey })
    }

    const onMouseOver = (event: MouseEvent): void => {
      if (!dragging.current) return
      const cell = cellAddressOf(event.target)
      if (cell === undefined) return
      grid.selection.dispatch({ type: 'focus', cell, extend: true })
    }

    const onMouseUp = (): void => {
      dragging.current = false
    }

    element.addEventListener('keydown', onKeyDown)
    element.addEventListener('mousedown', onMouseDown)
    element.addEventListener('mouseover', onMouseOver)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('mousedown', onMouseDown)
      element.removeEventListener('mouseover', onMouseOver)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [grid, viewport, onIntent])

  useEffect(
    () =>
      grid.selection.subscribe((selection) => {
        const active = selection.range?.focus ?? selection.active
        if (active === undefined) return
        const { items, rows, columns, layout, model } = latest.current
        const item = model.rows[active.row]
        if (item === undefined) return
        const itemIndex = items.indexOf(item)
        if (itemIndex !== -1 && !item.pinned) rows.scrollToIndex(itemIndex, { align: 'auto' })
        const entry = layout.columns[active.column]
        if (entry !== undefined && entry.pin === undefined) {
          columns.scrollToIndex(layout.center.indexOf(entry), { align: 'auto' })
        }
      }),
    [grid],
  )
}
