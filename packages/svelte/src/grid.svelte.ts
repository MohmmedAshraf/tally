import { createSubscriber } from 'svelte/reactivity'
import {
  holdGrid,
  type Grid,
  type GridOptions,
  type GridState,
  type HeldGrid,
  type RowState,
  type SelectionState,
  type Unsubscribe,
  type View,
} from 'tally-core'

export interface ReactiveGrid {
  readonly current: Grid
}

export interface Snapshot<T> {
  readonly current: T
}

export type GridInput = Grid | ReactiveGrid

export function resolveGrid(input: GridInput): Grid {
  return 'current' in input ? input.current : input
}

export function useGrid(options: () => GridOptions): ReactiveGrid {
  let held: HeldGrid | undefined
  const grid = $derived.by(() => {
    held = holdGrid(options(), held)
    return held.grid
  })
  $effect(() => {
    const current = grid
    void current.load()
    return () => current.dispose()
  })
  return {
    get current() {
      return grid
    },
  }
}

function snapshot<T>(
  input: GridInput,
  read: (grid: Grid) => T,
  subscribe: (grid: Grid, listener: () => void) => Unsubscribe,
): Snapshot<T> {
  const bound = $derived.by(() => {
    const grid = resolveGrid(input)
    return { grid, track: createSubscriber((update) => subscribe(grid, update)) }
  })
  return {
    get current() {
      bound.track()
      return read(bound.grid)
    },
  }
}

export function gridState(grid: GridInput): Snapshot<GridState> {
  return snapshot(
    grid,
    (current) => current.get(),
    (current, listener) => current.subscribe(listener),
  )
}

export function gridView(grid: GridInput): Snapshot<View> {
  return snapshot(
    grid,
    (current) => current.view.get(),
    (current, listener) => current.view.subscribe(listener),
  )
}

export function gridRows(grid: GridInput): Snapshot<RowState> {
  return snapshot(
    grid,
    (current) => current.rows.get(),
    (current, listener) => current.rows.subscribe(listener),
  )
}

export function gridSelection(grid: GridInput): Snapshot<SelectionState> {
  return snapshot(
    grid,
    (current) => current.selection.get(),
    (current, listener) => current.selection.subscribe(listener),
  )
}
