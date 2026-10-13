import {
  createElement,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  fillSeries,
  normalizeRange,
  type CellAddress,
  type CellEdit,
  type ColumnLayout,
  type Grid,
  type NormalizedRange,
  type RowModel,
} from 'tally-core'
import { editorFor, type CellEditors, type EditorMove } from './editors/editors.tsx'
import { isEditable, type EditingApi, type FillApi } from './interactions.ts'

interface EditingState {
  readonly cell: CellAddress
  readonly initial: string | undefined
}

interface FillState {
  readonly source: NormalizedRange
  readonly to: number
}

export interface EditingOptions {
  readonly grid: Grid
  readonly viewport: RefObject<HTMLDivElement | null>
  readonly layout: ColumnLayout
  readonly model: RowModel
  readonly editors: CellEditors
}

export interface EditingResult {
  readonly editing: EditingState | undefined
  readonly editor: ReactNode
  readonly api: EditingApi
}

const MOVES: Readonly<Record<EditorMove, { readonly rows: number; readonly columns: number }>> = {
  down: { rows: 1, columns: 0 },
  up: { rows: -1, columns: 0 },
  right: { rows: 0, columns: 1 },
  left: { rows: 0, columns: -1 },
}

export function useEditing({
  grid,
  viewport,
  layout,
  model,
  editors,
}: EditingOptions): EditingResult {
  const [editing, setEditing] = useState<EditingState | undefined>(undefined)

  const finish = useCallback(
    (move: EditorMove | undefined): void => {
      setEditing(undefined)
      viewport.current?.focus({ preventScroll: true })
      if (move !== undefined) grid.selection.dispatch({ type: 'move', ...MOVES[move] })
    },
    [grid, viewport],
  )

  const start = useCallback(
    (cell: CellAddress, initial: string | undefined): void => {
      const item = model.rows[cell.row]
      const entry = layout.columns[cell.column]
      if (item === undefined || entry === undefined || !isEditable(grid, layout, cell.column))
        return
      const type = grid.schema.typeOf(entry.column)
      if (type.kind === 'boolean') {
        const current = grid.schema.valueOf(item.row, entry.column)
        void grid.setCells([{ key: item.key, column: entry.column.id, value: current !== true }])
        return
      }
      grid.selection.dispatch({ type: 'focus', cell })
      setEditing({ cell, initial })
    },
    [grid, layout, model],
  )

  const editor = useMemo((): ReactNode => {
    if (editing === undefined) return null
    const item = model.rows[editing.cell.row]
    const entry = layout.columns[editing.cell.column]
    if (item === undefined || entry === undefined) return null
    const type = grid.schema.typeOf(entry.column)
    return createElement(editorFor(editors, type), {
      value: grid.schema.valueOf(item.row, entry.column),
      initial: editing.initial,
      column: entry.column,
      type,
      format: grid.context.format,
      commit: (value, move) => {
        void grid.setCells([{ key: item.key, column: entry.column.id, value }])
        finish(move)
      },
      cancel: () => finish(undefined),
    })
  }, [editing, editors, finish, grid, layout, model])

  const api = useMemo<EditingApi>(
    () => ({ start, active: editing !== undefined }),
    [start, editing],
  )
  return { editing, editor, api }
}

export interface FillResult {
  readonly fill: NormalizedRange | undefined
  readonly api: FillApi
}

export function useFill(grid: Grid, layout: ColumnLayout, model: RowModel): FillResult {
  const [state, setState] = useState<FillState | undefined>(undefined)
  const api = useMemo<FillApi>(
    () => ({
      start: (source) => setState({ source, to: source.bottom }),
      move: (row) =>
        setState((current) => (current === undefined ? current : { ...current, to: row })),
      finish: () => {
        setState((current) => {
          if (current !== undefined) applyFill(grid, layout, model, current)
          return undefined
        })
      },
    }),
    [grid, layout, model],
  )
  const fill = state === undefined ? undefined : previewRange(state)
  return { fill, api }
}

function previewRange(state: FillState): NormalizedRange | undefined {
  const { source, to } = state
  if (to > source.bottom) return { ...source, top: source.bottom + 1, bottom: to }
  if (to < source.top) return { ...source, top: to, bottom: source.top - 1 }
  return undefined
}

function applyFill(grid: Grid, layout: ColumnLayout, model: RowModel, state: FillState): void {
  const target = previewRange(state)
  if (target === undefined) return
  const { source } = state
  const downward = target.top > source.bottom
  const edits: CellEdit[] = []
  for (let column = source.left; column <= source.right; column += 1) {
    const entry = layout.columns[column]
    if (entry === undefined || !isEditable(grid, layout, column)) continue
    const type = grid.schema.typeOf(entry.column)
    const values: unknown[] = []
    for (let row = source.top; row <= source.bottom; row += 1) {
      const item = model.rows[row]
      if (item !== undefined) values.push(grid.schema.valueOf(item.row, entry.column))
    }
    const count = target.bottom - target.top + 1
    const series = fillSeries(downward ? values : values.toReversed(), count, type.kind)
    series.forEach((value, offset) => {
      const row = downward ? target.top + offset : target.bottom - offset
      const item = model.rows[row]
      if (item !== undefined) edits.push({ key: item.key, column: entry.column.id, value })
    })
  }
  void grid.setCells(edits)
  const box = normalizeRange({
    anchor: { row: Math.min(source.top, target.top), column: source.left },
    focus: { row: Math.max(source.bottom, target.bottom), column: source.right },
  })
  grid.selection.dispatch({ type: 'focus', cell: { row: box.top, column: box.left } })
  grid.selection.dispatch({
    type: 'focus',
    cell: { row: box.bottom, column: box.right },
    extend: true,
  })
}
