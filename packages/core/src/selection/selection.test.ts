import { describe, expect, it } from 'vitest'
import { keyboardIntent } from './keyboard.ts'
import {
  emptySelection,
  isCellInRange,
  normalizeRange,
  rangeSize,
  reduceSelection,
  type GridGeometry,
  type SelectionState,
} from './selection.ts'

const keys = ['a', 'b', 'c', 'd', 'e']
const geometry: GridGeometry = {
  rowCount: 5,
  columnCount: 3,
  pageSize: 2,
  rowKeyAt: (index) => keys[index],
}

function run(...actions: Parameters<typeof reduceSelection>[1][]): SelectionState {
  return actions.reduce((state, action) => reduceSelection(state, action, geometry), emptySelection)
}

describe('reduceSelection', () => {
  it('focuses, moves and clamps', () => {
    const state = run(
      { type: 'focus', cell: { row: 1, column: 1 } },
      { type: 'move', rows: 9, columns: -5 },
    )
    expect(state.active).toEqual({ row: 4, column: 0 })
    expect(state.range).toEqual({ anchor: { row: 4, column: 0 }, focus: { row: 4, column: 0 } })
    expect(run({ type: 'move', rows: 1, columns: 1 }).active).toEqual({ row: 1, column: 1 })
  })

  it('extends ranges from the anchor and jumps to edges', () => {
    const state = run(
      { type: 'focus', cell: { row: 1, column: 1 } },
      { type: 'move', rows: 2, columns: 0, extend: true },
      { type: 'move', rows: 0, columns: 1, extend: true, jump: true },
    )
    expect(state.active).toEqual({ row: 1, column: 1 })
    expect(normalizeRange(state.range!)).toEqual({ top: 1, bottom: 3, left: 1, right: 2 })
    expect(rangeSize(state.range)).toBe(6)
    expect(isCellInRange({ row: 2, column: 2 }, state.range)).toBe(true)
    expect(isCellInRange({ row: 0, column: 0 }, state.range)).toBe(false)
    expect(isCellInRange({ row: 0, column: 0 }, undefined)).toBe(false)
    expect(rangeSize(undefined)).toBe(0)
    const shifted = reduceSelection(
      state,
      { type: 'focus', cell: { row: 0, column: 0 }, extend: true },
      geometry,
    )
    expect(shifted.range?.anchor).toEqual({ row: 1, column: 1 })
  })

  it('selects rows by toggle, range and only', () => {
    let state = run({ type: 'selectRow', index: 1, mode: 'toggle' })
    expect([...state.rows]).toEqual(['b'])
    state = reduceSelection(state, { type: 'selectRow', index: 3, mode: 'range' }, geometry)
    expect([...state.rows]).toEqual(['b', 'c', 'd'])
    state = reduceSelection(state, { type: 'selectRow', index: 2, mode: 'range' }, geometry)
    expect([...state.rows]).toEqual(['b'])
    state = reduceSelection(state, { type: 'selectRow', index: 4, mode: 'only' }, geometry)
    expect([...state.rows]).toEqual(['e'])
    state = reduceSelection(state, { type: 'selectRow', index: 4, mode: 'toggle' }, geometry)
    expect(state.rows.size).toBe(0)
    state = reduceSelection(state, { type: 'selectRow', index: 9, mode: 'toggle' }, geometry)
    expect(state.rows.size).toBe(0)
    state = reduceSelection(state, { type: 'selectRows', keys: ['a', 'e'] }, geometry)
    expect([...state.rows]).toEqual(['a', 'e'])
    state = reduceSelection(state, { type: 'clearRows' }, geometry)
    expect(state.rows.size).toBe(0)
  })

  it('selects every cell and clears', () => {
    const all = run({ type: 'selectAllCells' })
    expect(normalizeRange(all.range!)).toEqual({ top: 0, bottom: 4, left: 0, right: 2 })
    expect(all.active).toEqual({ row: 0, column: 0 })
    expect(reduceSelection(all, { type: 'clear' }, geometry)).toBe(emptySelection)
  })

  it('drops the active cell when the grid is empty', () => {
    const empty: GridGeometry = { rowCount: 0, columnCount: 3, rowKeyAt: () => undefined }
    const state = run(
      { type: 'focus', cell: { row: 1, column: 1 } },
      { type: 'selectRow', index: 0, mode: 'toggle' },
    )
    expect(
      reduceSelection(state, { type: 'move', rows: 1, columns: 0 }, empty).active,
    ).toBeUndefined()
    expect(reduceSelection(state, { type: 'clearRows' }, empty).rows.size).toBe(0)
    expect(reduceSelection(state, { type: 'clear' }, empty)).toBe(emptySelection)
    expect(reduceSelection(emptySelection, { type: 'move', rows: 1, columns: 0 }, empty)).toBe(
      emptySelection,
    )
  })
})

describe('keyboardIntent', () => {
  const focused = run({ type: 'focus', cell: { row: 1, column: 1 } })

  it('maps navigation keys', () => {
    expect(keyboardIntent({ key: 'ArrowDown' }, focused, geometry)).toEqual({
      type: 'select',
      action: { type: 'move', rows: 1, columns: 0, extend: false, jump: false },
    })
    expect(keyboardIntent({ key: 'ArrowUp', shiftKey: true }, focused, geometry)).toMatchObject({
      action: { rows: -1, extend: true },
    })
    expect(keyboardIntent({ key: 'PageDown' }, focused, geometry)).toMatchObject({
      action: { rows: 2 },
    })
    expect(keyboardIntent({ key: 'Home' }, focused, geometry)).toMatchObject({
      action: { columns: -1, jump: true },
    })
    expect(keyboardIntent({ key: 'End' }, focused, geometry)).toMatchObject({
      action: { columns: 1, jump: true },
    })
    expect(keyboardIntent({ key: 'Tab', shiftKey: true }, focused, geometry)).toMatchObject({
      action: { columns: -1 },
    })
    expect(keyboardIntent({ key: 'ArrowRight', altKey: true }, focused, geometry)).toEqual({
      type: 'expand',
      open: true,
    })
    expect(keyboardIntent({ key: 'ArrowLeft', altKey: true }, focused, geometry)).toEqual({
      type: 'expand',
      open: false,
    })
  })

  it('maps primary shortcuts per platform', () => {
    const mac = { platform: 'mac' } as const
    expect(keyboardIntent({ key: 'c', metaKey: true }, focused, geometry, mac)).toEqual({
      type: 'copy',
    })
    expect(keyboardIntent({ key: 'c', ctrlKey: true }, focused, geometry)).toEqual({ type: 'copy' })
    expect(keyboardIntent({ key: 'c', metaKey: true }, focused, geometry)).toEqual({
      type: 'edit',
      initial: 'c',
    })
    expect(keyboardIntent({ key: 'z', ctrlKey: true }, focused, geometry)).toEqual({ type: 'undo' })
    expect(keyboardIntent({ key: 'Z', ctrlKey: true, shiftKey: true }, focused, geometry)).toEqual({
      type: 'redo',
    })
    expect(keyboardIntent({ key: 'y', ctrlKey: true }, focused, geometry)).toEqual({ type: 'redo' })
    expect(keyboardIntent({ key: 'a', ctrlKey: true }, focused, geometry)).toEqual({
      type: 'select',
      action: { type: 'selectAllCells' },
    })
    expect(keyboardIntent({ key: 'x', ctrlKey: true }, focused, geometry)).toEqual({ type: 'cut' })
    expect(keyboardIntent({ key: 'v', ctrlKey: true }, focused, geometry)).toEqual({
      type: 'paste',
    })
    expect(keyboardIntent({ key: 'k', ctrlKey: true }, focused, geometry)).toEqual({
      type: 'commandPalette',
    })
    expect(keyboardIntent({ key: 'ArrowDown', ctrlKey: true }, focused, geometry)).toMatchObject({
      action: { rows: 1, jump: true },
    })
    expect(keyboardIntent({ key: 'Home', ctrlKey: true }, focused, geometry)).toMatchObject({
      action: { type: 'focus', cell: { row: 0, column: 0 } },
    })
    expect(keyboardIntent({ key: 'End', ctrlKey: true }, focused, geometry)).toMatchObject({
      action: { cell: { row: 4, column: 2 } },
    })
    expect(keyboardIntent({ key: 'q', ctrlKey: true }, focused, geometry)).toBeUndefined()
  })

  it('maps editing and misc keys', () => {
    expect(keyboardIntent({ key: 'Enter' }, focused, geometry)).toEqual({ type: 'edit' })
    expect(keyboardIntent({ key: 'F2' }, focused, geometry)).toEqual({ type: 'edit' })
    expect(keyboardIntent({ key: 'Enter' }, emptySelection, geometry)).toBeUndefined()
    expect(keyboardIntent({ key: '7' }, focused, geometry)).toEqual({ type: 'edit', initial: '7' })
    expect(keyboardIntent({ key: '7' }, emptySelection, geometry)).toBeUndefined()
    expect(keyboardIntent({ key: 'Delete' }, focused, geometry)).toEqual({ type: 'clearCells' })
    expect(keyboardIntent({ key: 'Backspace' }, emptySelection, geometry)).toBeUndefined()
    expect(keyboardIntent({ key: ' ' }, focused, geometry)).toEqual({ type: 'inspect' })
    expect(keyboardIntent({ key: ' ', shiftKey: true }, focused, geometry)).toEqual({
      type: 'toggleRow',
    })
    expect(keyboardIntent({ key: '/' }, focused, geometry)).toEqual({ type: 'focusFilter' })
    expect(keyboardIntent({ key: 'Escape' }, focused, geometry)).toEqual({ type: 'escape' })
    expect(keyboardIntent({ key: 'F5' }, focused, geometry)).toBeUndefined()
    expect(keyboardIntent({ key: 'a', altKey: true }, focused, geometry)).toBeUndefined()
  })

  it('only honours escape while editing', () => {
    expect(
      keyboardIntent({ key: 'ArrowDown' }, focused, geometry, { editing: true }),
    ).toBeUndefined()
    expect(keyboardIntent({ key: 'Escape' }, focused, geometry, { editing: true })).toEqual({
      type: 'escape',
    })
  })
})
