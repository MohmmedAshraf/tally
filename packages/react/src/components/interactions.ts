import type { Virtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  isCellInRange,
  keyboardIntent,
  normalizeRange,
  toTsv,
  type CellAddress,
  type CellEdit,
  type ColumnLayout,
  type Grid,
  type GridIntent,
  type NormalizedRange,
  type RowModel,
  type RowModelItem,
  type SelectionState,
} from 'tally-core'

export type IntentHandler = (intent: GridIntent) => boolean | undefined

export interface EditingApi {
  start(cell: CellAddress, initial: string | undefined): void
  readonly active: boolean
}

export interface FillApi {
  start(range: NormalizedRange): void
  move(row: number): void
  finish(): void
}

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
  readonly editing: EditingApi
  readonly fill: FillApi
  readonly focusFilter: () => void
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

function selectedRows(selection: SelectionState, model: RowModel): readonly number[] {
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
  const indexes = selectedRows(selection, model)
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

export function isEditable(grid: Grid, layout: ColumnLayout, column: number): boolean {
  const entry = layout.columns[column]
  return grid.capabilities.mutate && entry !== undefined && entry.column.editable !== false
}

function clearSelectedCells(grid: Grid, layout: ColumnLayout, model: RowModel): void {
  const selection = grid.selection.get()
  if (selection.range === undefined) return
  const box = normalizeRange(selection.range)
  const edits: CellEdit[] = []
  for (let row = box.top; row <= box.bottom; row += 1) {
    const item = model.rows[row]
    if (item === undefined) continue
    for (let column = box.left; column <= box.right; column += 1) {
      const entry = layout.columns[column]
      if (entry === undefined || !isEditable(grid, layout, column)) continue
      edits.push({ key: item.key, column: entry.column.id, value: null })
    }
  }
  void grid.setCells(edits, 'Clear')
}

function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

function pasteAt(
  grid: Grid,
  layout: ColumnLayout,
  model: RowModel,
  origin: CellAddress,
  table: readonly (readonly string[])[],
): void {
  const edits: CellEdit[] = []
  table.forEach((line, rowOffset) => {
    const item = model.rows[origin.row + rowOffset]
    if (item === undefined) return
    line.forEach((text, columnOffset) => {
      const column = origin.column + columnOffset
      const entry = layout.columns[column]
      if (entry === undefined || !isEditable(grid, layout, column)) return
      edits.push({ key: item.key, column: entry.column.id, value: text })
    })
  })
  void grid.setCells(edits, 'Paste')
  if (table.length === 0) return
  grid.selection.dispatch({ type: 'focus', cell: origin })
  grid.selection.dispatch({
    type: 'focus',
    cell: {
      row: origin.row + table.length - 1,
      column: origin.column + Math.max(0, (table[0]?.length ?? 1) - 1),
    },
    extend: true,
  })
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
  const dragging = useRef<'select' | 'fill' | undefined>(undefined)

  useEffect(() => {
    const element = viewport.current
    if (element === null) return
    const platform = platformOf()

    const handle = (intent: GridIntent): void => {
      if (onIntent?.(intent) === true) return
      const { layout, model, editing } = latest.current
      const active = grid.selection.get().active
      switch (intent.type) {
        case 'select':
          grid.selection.dispatch(intent.action)
          return
        case 'copy': {
          const text = copySelection(grid, layout, model)
          if (text !== '') void navigator.clipboard.writeText(text)
          return
        }
        case 'cut': {
          const text = copySelection(grid, layout, model)
          if (text !== '') void navigator.clipboard.writeText(text)
          clearSelectedCells(grid, layout, model)
          return
        }
        case 'paste': {
          if (active === undefined) return
          const paste = async (): Promise<void> => {
            const text = await navigator.clipboard.readText()
            pasteAt(grid, latest.current.layout, latest.current.model, active, parseClipboard(text))
          }
          void paste()
          return
        }
        case 'clearCells':
          clearSelectedCells(grid, layout, model)
          return
        case 'edit':
          if (active !== undefined && isEditable(grid, layout, active.column)) {
            editing.start(active, intent.initial)
          }
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
        case 'toggleRow':
          if (active !== undefined) {
            grid.selection.dispatch({ type: 'selectRow', index: active.row, mode: 'toggle' })
          }
          return
        case 'expand': {
          const item = active === undefined ? undefined : model.rows[active.row]
          if (item?.hasChildren === true) grid.view.setExpanded(item.key, intent.open)
          return
        }
        case 'focusFilter':
          latest.current.focusFilter()
          return
        case 'inspect':
        case 'commandPalette':
          return
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || latest.current.editing.active || event.target !== element) {
        return
      }
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const active = grid.selection.get().active
        const next = active === undefined ? -1 : active.column + (event.shiftKey ? -1 : 1)
        if (next < 0 || next >= grid.selection.geometry().columnCount) return
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
      event.preventDefault()
      handle(intent)
    }

    const onFocus = (event: FocusEvent): void => {
      if (event.target !== element || dragging.current !== undefined) return
      if (grid.selection.get().active !== undefined || !element.matches(':focus-visible')) return
      const { rowCount, columnCount } = grid.selection.geometry()
      if (rowCount === 0 || columnCount === 0) return
      grid.selection.dispatch({ type: 'focus', cell: { row: 0, column: 0 } })
    }

    const onMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      if (event.target.closest('[data-fill-handle]') !== null) {
        const range = grid.selection.get().range
        if (range === undefined) return
        event.preventDefault()
        dragging.current = 'fill'
        latest.current.fill.start(normalizeRange(range))
        return
      }
      const cell = cellAddressOf(event.target)
      if (cell === undefined) return
      if (event.target.closest('a, button, input, textarea, [role="combobox"]') !== null) return
      event.preventDefault()
      dragging.current = 'select'
      element.focus({ preventScroll: true })
      grid.selection.dispatch({ type: 'focus', cell, extend: event.shiftKey })
    }

    const onDoubleClick = (event: MouseEvent): void => {
      const cell = cellAddressOf(event.target)
      if (cell === undefined || !isEditable(grid, latest.current.layout, cell.column)) return
      if (event.target instanceof Element && event.target.closest('a, button, input') !== null) {
        return
      }
      latest.current.editing.start(cell, undefined)
    }

    const onMouseOver = (event: MouseEvent): void => {
      if (dragging.current === undefined) return
      const cell = cellAddressOf(event.target)
      if (cell === undefined) return
      if (dragging.current === 'fill') latest.current.fill.move(cell.row)
      else grid.selection.dispatch({ type: 'focus', cell, extend: true })
    }

    const onMouseUp = (): void => {
      if (dragging.current === 'fill') latest.current.fill.finish()
      dragging.current = undefined
    }

    element.addEventListener('keydown', onKeyDown)
    element.addEventListener('focus', onFocus)
    element.addEventListener('mousedown', onMouseDown)
    element.addEventListener('dblclick', onDoubleClick)
    element.addEventListener('mouseover', onMouseOver)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('focus', onFocus)
      element.removeEventListener('mousedown', onMouseDown)
      element.removeEventListener('dblclick', onDoubleClick)
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
