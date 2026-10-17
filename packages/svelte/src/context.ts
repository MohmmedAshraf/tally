import { getContext, setContext } from 'svelte'
import { TallyError } from 'tally-core'
import { resolveGrid, type GridInput, type ReactiveGrid } from './grid.svelte.ts'

const gridKey = Symbol('tally-grid')

export function setGridContext(grid: GridInput): ReactiveGrid {
  return setContext<ReactiveGrid>(gridKey, {
    get current() {
      return resolveGrid(grid)
    },
  })
}

export function getGridContext(): ReactiveGrid {
  const grid = getContext<ReactiveGrid | undefined>(gridKey)
  if (grid === undefined) {
    throw new TallyError('invalid_value', 'getGridContext must be used below setGridContext')
  }
  return grid
}
