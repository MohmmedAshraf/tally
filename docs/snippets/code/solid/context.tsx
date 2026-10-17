import type { JSX } from 'solid-js'
import type { GridOptions } from 'tally-core'
import { GridContext, createGridState, useGrid, useGridContext } from 'tally-solid'

function Total(): JSX.Element {
  const state = createGridState(useGridContext())
  return <span>{state().total ?? 0}</span>
}

export function Accounts(props: { options: GridOptions }): JSX.Element {
  const grid = useGrid(() => props.options)
  return (
    <GridContext.Provider value={grid}>
      <Total />
    </GridContext.Provider>
  )
}
