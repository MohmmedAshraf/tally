import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'
import type { Grid, GridState, RowState, SelectionState, Unsubscribe, View } from 'tally-core'
import { access, type MaybeAccessor } from './access.ts'

function createSnapshot<T>(
  source: MaybeAccessor<Grid>,
  read: (grid: Grid) => T,
  subscribe: (grid: Grid, listener: () => void) => Unsubscribe,
): Accessor<T> {
  const [snapshot, setSnapshot] = createSignal(read(access(source)))
  createEffect(() => {
    const grid = access(source)
    const update = (): void => {
      setSnapshot(() => read(grid))
    }
    update()
    onCleanup(subscribe(grid, update))
  })
  return snapshot
}

export function createGridState(grid: MaybeAccessor<Grid>): Accessor<GridState> {
  return createSnapshot(
    grid,
    (current) => current.get(),
    (current, listener) => current.subscribe(listener),
  )
}

export function createView(grid: MaybeAccessor<Grid>): Accessor<View> {
  return createSnapshot(
    grid,
    (current) => current.view.get(),
    (current, listener) => current.view.subscribe(listener),
  )
}

export function createRows(grid: MaybeAccessor<Grid>): Accessor<RowState> {
  return createSnapshot(
    grid,
    (current) => current.rows.get(),
    (current, listener) => current.rows.subscribe(listener),
  )
}

export function createSelection(grid: MaybeAccessor<Grid>): Accessor<SelectionState> {
  return createSnapshot(
    grid,
    (current) => current.selection.get(),
    (current, listener) => current.selection.subscribe(listener),
  )
}
