import { toStore, type Readable } from 'svelte/store'
import type { GridState, RowState, SelectionState, View } from 'tally-core'
import { gridRows, gridSelection, gridState, gridView, type GridInput } from './grid.svelte.ts'

export interface GridStores {
  readonly state: Readable<GridState>
  readonly view: Readable<View>
  readonly rows: Readable<RowState>
  readonly selection: Readable<SelectionState>
}

export function gridStores(grid: GridInput): GridStores {
  const state = gridState(grid)
  const view = gridView(grid)
  const rows = gridRows(grid)
  const selection = gridSelection(grid)
  return {
    state: toStore(() => state.current),
    view: toStore(() => view.current),
    rows: toStore(() => rows.current),
    selection: toStore(() => selection.current),
  }
}
