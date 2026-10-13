import type { GridGeometry, SelectionAction, SelectionState } from './selection.ts'

export interface KeyInput {
  readonly key: string
  readonly shiftKey?: boolean | undefined
  readonly metaKey?: boolean | undefined
  readonly ctrlKey?: boolean | undefined
  readonly altKey?: boolean | undefined
}

export type GridIntent =
  | { readonly type: 'select'; readonly action: SelectionAction }
  | { readonly type: 'edit'; readonly initial?: string | undefined }
  | { readonly type: 'clearCells' }
  | { readonly type: 'copy' }
  | { readonly type: 'cut' }
  | { readonly type: 'paste' }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'escape' }
  | { readonly type: 'inspect' }
  | { readonly type: 'toggleRow' }
  | { readonly type: 'expand'; readonly open: boolean }
  | { readonly type: 'focusFilter' }
  | { readonly type: 'commandPalette' }

export interface KeyboardOptions {
  readonly editing?: boolean | undefined
  readonly platform?: 'mac' | 'other' | undefined
}

function isPrimary(input: KeyInput, platform: KeyboardOptions['platform']): boolean {
  return platform === 'mac' ? input.metaKey === true : input.ctrlKey === true
}

function select(action: SelectionAction): GridIntent {
  return { type: 'select', action }
}

function move(rows: number, columns: number, input: KeyInput, jump = false): GridIntent {
  return select({ type: 'move', rows, columns, extend: input.shiftKey === true, jump })
}

export function keyboardIntent(
  input: KeyInput,
  state: SelectionState,
  geometry: GridGeometry,
  options: KeyboardOptions = {},
): GridIntent | undefined {
  if (options.editing === true) {
    return input.key === 'Escape' ? { type: 'escape' } : undefined
  }
  const primary = isPrimary(input, options.platform ?? 'other')
  const page = Math.max(1, geometry.pageSize ?? 10)
  if (primary) {
    switch (input.key.toLowerCase()) {
      case 'a':
        return select({ type: 'selectAllCells' })
      case 'c':
        return { type: 'copy' }
      case 'x':
        return { type: 'cut' }
      case 'v':
        return { type: 'paste' }
      case 'z':
        return input.shiftKey === true ? { type: 'redo' } : { type: 'undo' }
      case 'y':
        return { type: 'redo' }
      case 'k':
        return { type: 'commandPalette' }
      case 'arrowup':
        return move(-1, 0, input, true)
      case 'arrowdown':
        return move(1, 0, input, true)
      case 'arrowleft':
        return move(0, -1, input, true)
      case 'arrowright':
        return move(0, 1, input, true)
      case 'home':
        return select({
          type: 'focus',
          cell: { row: 0, column: 0 },
          extend: input.shiftKey === true,
        })
      case 'end':
        return select({
          type: 'focus',
          cell: { row: geometry.rowCount - 1, column: geometry.columnCount - 1 },
          extend: input.shiftKey === true,
        })
      default:
        return undefined
    }
  }
  switch (input.key) {
    case 'ArrowUp':
      return move(-1, 0, input)
    case 'ArrowDown':
      return move(1, 0, input)
    case 'ArrowLeft':
      return input.altKey === true ? { type: 'expand', open: false } : move(0, -1, input)
    case 'ArrowRight':
      return input.altKey === true ? { type: 'expand', open: true } : move(0, 1, input)
    case 'PageUp':
      return move(-page, 0, input)
    case 'PageDown':
      return move(page, 0, input)
    case 'Home':
      return move(0, -1, input, true)
    case 'End':
      return move(0, 1, input, true)
    case 'Tab':
      return select({ type: 'move', rows: 0, columns: input.shiftKey === true ? -1 : 1 })
    case 'Enter':
      return state.active === undefined ? undefined : { type: 'edit' }
    case 'F2':
      return state.active === undefined ? undefined : { type: 'edit' }
    case ' ':
      return input.shiftKey === true ? { type: 'toggleRow' } : { type: 'inspect' }
    case 'Escape':
      return { type: 'escape' }
    case 'Delete':
    case 'Backspace':
      return state.active === undefined ? undefined : { type: 'clearCells' }
    case '/':
      return { type: 'focusFilter' }
    default:
      break
  }
  if (input.key.length === 1 && input.altKey !== true && state.active !== undefined) {
    return { type: 'edit', initial: input.key }
  }
  return undefined
}
