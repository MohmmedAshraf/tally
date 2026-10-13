import { useCallback, useSyncExternalStore } from 'react'
import type {
  ColumnLayout,
  Grid,
  GridState,
  RowModel,
  RowState,
  SelectionState,
  Unsubscribe,
  View,
} from 'tally-core'

type Listener = () => void

function identity<T>(value: T): T {
  return value
}

function useSnapshot<T>(subscribe: (listener: Listener) => Unsubscribe, read: () => T): T {
  return useSyncExternalStore(subscribe, read, read)
}

export function useGridState(grid: Grid): GridState
export function useGridState<T>(grid: Grid, selector: (state: GridState) => T): T
export function useGridState<T>(
  grid: Grid,
  selector: (state: GridState) => T | GridState = identity,
): T | GridState {
  return useSnapshot(
    (listener) => grid.subscribe(listener),
    () => selector(grid.get()),
  )
}

export function useView(grid: Grid): View
export function useView<T>(grid: Grid, selector: (view: View) => T): T
export function useView<T>(grid: Grid, selector: (view: View) => T | View = identity): T | View {
  return useSnapshot(
    (listener) => grid.view.subscribe(listener),
    () => selector(grid.view.get()),
  )
}

export function useRows(grid: Grid): RowState {
  return useSnapshot(
    (listener) => grid.rows.subscribe(listener),
    () => grid.rows.get(),
  )
}

export function useSelection(grid: Grid): SelectionState {
  return useSnapshot(
    (listener) => grid.selection.subscribe(listener),
    () => grid.selection.get(),
  )
}

export function useColumnLayout(grid: Grid): ColumnLayout {
  return useSnapshot(
    (listener) => grid.view.subscribe(listener),
    () => grid.layout(),
  )
}

export function useRowModel(grid: Grid): RowModel {
  const subscribe = useCallback(
    (listener: Listener): Unsubscribe => {
      const stops = [
        grid.rows.subscribe(listener),
        grid.view.subscribe(listener),
        grid.subscribe(listener),
      ]
      return () => {
        for (const stop of stops) stop()
      }
    },
    [grid],
  )
  return useSnapshot(subscribe, () => grid.model())
}
