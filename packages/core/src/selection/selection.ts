import type { RowKey } from '../rows/row.ts'

export interface CellAddress {
  readonly row: number
  readonly column: number
}

export interface CellRange {
  readonly anchor: CellAddress
  readonly focus: CellAddress
}

export interface NormalizedRange {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

export interface SelectionState {
  readonly active: CellAddress | undefined
  readonly range: CellRange | undefined
  readonly rows: ReadonlySet<RowKey>
  readonly lastRowIndex: number | undefined
}

export interface GridGeometry {
  readonly rowCount: number
  readonly columnCount: number
  readonly pageSize?: number | undefined
  rowKeyAt(index: number): RowKey | undefined
}

export type SelectionAction =
  | { readonly type: 'focus'; readonly cell: CellAddress; readonly extend?: boolean | undefined }
  | {
      readonly type: 'move'
      readonly rows: number
      readonly columns: number
      readonly extend?: boolean | undefined
      readonly jump?: boolean | undefined
    }
  | {
      readonly type: 'selectRow'
      readonly index: number
      readonly mode: 'toggle' | 'range' | 'only'
    }
  | { readonly type: 'selectRows'; readonly keys: readonly RowKey[] }
  | { readonly type: 'clearRows' }
  | { readonly type: 'selectAllCells' }
  | { readonly type: 'clear' }

export const emptySelection: SelectionState = {
  active: undefined,
  range: undefined,
  rows: new Set(),
  lastRowIndex: undefined,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampCell(cell: CellAddress, geometry: GridGeometry): CellAddress {
  return {
    row: clamp(cell.row, 0, Math.max(0, geometry.rowCount - 1)),
    column: clamp(cell.column, 0, Math.max(0, geometry.columnCount - 1)),
  }
}

export function normalizeRange(range: CellRange): NormalizedRange {
  return {
    top: Math.min(range.anchor.row, range.focus.row),
    bottom: Math.max(range.anchor.row, range.focus.row),
    left: Math.min(range.anchor.column, range.focus.column),
    right: Math.max(range.anchor.column, range.focus.column),
  }
}

export function isCellInRange(cell: CellAddress, range: CellRange | undefined): boolean {
  if (range === undefined) return false
  const box = normalizeRange(range)
  return (
    cell.row >= box.top &&
    cell.row <= box.bottom &&
    cell.column >= box.left &&
    cell.column <= box.right
  )
}

export function rangeSize(range: CellRange | undefined): number {
  if (range === undefined) return 0
  const box = normalizeRange(range)
  return (box.bottom - box.top + 1) * (box.right - box.left + 1)
}

function focusCell(state: SelectionState, cell: CellAddress, extend: boolean): SelectionState {
  if (extend && state.active !== undefined) {
    return { ...state, range: { anchor: state.range?.anchor ?? state.active, focus: cell } }
  }
  return { ...state, active: cell, range: { anchor: cell, focus: cell } }
}

function selectRowRange(
  state: SelectionState,
  index: number,
  geometry: GridGeometry,
): SelectionState {
  const from = state.lastRowIndex ?? index
  const start = Math.min(from, index)
  const end = Math.max(from, index)
  const key = geometry.rowKeyAt(index)
  const turnOn = key === undefined ? true : !state.rows.has(key)
  const rows = new Set(state.rows)
  for (let position = start; position <= end; position += 1) {
    const candidate = geometry.rowKeyAt(position)
    if (candidate === undefined) continue
    if (turnOn) rows.add(candidate)
    else rows.delete(candidate)
  }
  return { ...state, rows, lastRowIndex: index }
}

export function reduceSelection(
  state: SelectionState,
  action: SelectionAction,
  geometry: GridGeometry,
): SelectionState {
  if (geometry.rowCount === 0 || geometry.columnCount === 0) {
    if (action.type === 'clear') return emptySelection
    if (action.type === 'clearRows') return { ...state, rows: new Set(), lastRowIndex: undefined }
    return state.active === undefined ? state : { ...state, active: undefined, range: undefined }
  }
  switch (action.type) {
    case 'focus':
      return focusCell(state, clampCell(action.cell, geometry), action.extend === true)
    case 'move': {
      const origin =
        action.extend === true && state.range !== undefined
          ? state.range.focus
          : (state.active ?? { row: 0, column: 0 })
      const target = clampCell(
        {
          row:
            action.jump === true && action.rows !== 0
              ? action.rows > 0
                ? geometry.rowCount - 1
                : 0
              : origin.row + action.rows,
          column:
            action.jump === true && action.columns !== 0
              ? action.columns > 0
                ? geometry.columnCount - 1
                : 0
              : origin.column + action.columns,
        },
        geometry,
      )
      return focusCell(state, target, action.extend === true)
    }
    case 'selectRow': {
      const key = geometry.rowKeyAt(action.index)
      if (key === undefined) return state
      if (action.mode === 'range') return selectRowRange(state, action.index, geometry)
      if (action.mode === 'only')
        return { ...state, rows: new Set([key]), lastRowIndex: action.index }
      const rows = new Set(state.rows)
      if (rows.has(key)) rows.delete(key)
      else rows.add(key)
      return { ...state, rows, lastRowIndex: action.index }
    }
    case 'selectRows':
      return { ...state, rows: new Set(action.keys), lastRowIndex: undefined }
    case 'clearRows':
      return { ...state, rows: new Set(), lastRowIndex: undefined }
    case 'selectAllCells':
      return {
        ...state,
        active: state.active ?? { row: 0, column: 0 },
        range: {
          anchor: { row: 0, column: 0 },
          focus: { row: geometry.rowCount - 1, column: geometry.columnCount - 1 },
        },
      }
    case 'clear':
      return emptySelection
  }
}
