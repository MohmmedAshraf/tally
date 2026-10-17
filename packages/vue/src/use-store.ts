import {
  shallowReadonly,
  shallowRef,
  toValue,
  watchPostEffect,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue'
import type { Grid, GridState, RowState, SelectionState, Unsubscribe, View } from 'tally-core'

function useSnapshot<T>(
  source: MaybeRefOrGetter<Grid>,
  read: (grid: Grid) => T,
  subscribe: (grid: Grid, listener: () => void) => Unsubscribe,
): Readonly<ShallowRef<T>> {
  const snapshot = shallowRef(read(toValue(source)))
  watchPostEffect((onCleanup) => {
    const grid = toValue(source)
    const update = (): void => {
      snapshot.value = read(grid)
    }
    update()
    onCleanup(subscribe(grid, update))
  })
  return shallowReadonly(snapshot)
}

export function useGridState(grid: MaybeRefOrGetter<Grid>): Readonly<ShallowRef<GridState>> {
  return useSnapshot(
    grid,
    (current) => current.get(),
    (current, listener) => current.subscribe(listener),
  )
}

export function useView(grid: MaybeRefOrGetter<Grid>): Readonly<ShallowRef<View>> {
  return useSnapshot(
    grid,
    (current) => current.view.get(),
    (current, listener) => current.view.subscribe(listener),
  )
}

export function useRows(grid: MaybeRefOrGetter<Grid>): Readonly<ShallowRef<RowState>> {
  return useSnapshot(
    grid,
    (current) => current.rows.get(),
    (current, listener) => current.rows.subscribe(listener),
  )
}

export function useSelection(grid: MaybeRefOrGetter<Grid>): Readonly<ShallowRef<SelectionState>> {
  return useSnapshot(
    grid,
    (current) => current.selection.get(),
    (current, listener) => current.selection.subscribe(listener),
  )
}
