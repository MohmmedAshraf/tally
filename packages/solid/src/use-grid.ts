import { createEffect, createMemo, onCleanup, type Accessor } from 'solid-js'
import { holdGrid, type Grid, type GridOptions, type HeldGrid } from 'tally-core'
import { access, type MaybeAccessor } from './access.ts'

export function useGrid(options: MaybeAccessor<GridOptions>): Accessor<Grid> {
  const held = createMemo<HeldGrid, HeldGrid | undefined>(
    (previous) => holdGrid(access(options), previous),
    undefined,
  )
  createEffect(() => {
    const { grid } = held()
    void grid.load()
    onCleanup(() => grid.dispose())
  })
  return () => held().grid
}
