import { createContext, useContext, type Accessor, type Context } from 'solid-js'
import { TallyError, type Grid } from 'tally-core'

export const GridContext: Context<Accessor<Grid> | undefined> = createContext<Accessor<Grid>>()

export function useGridContext(): Accessor<Grid> {
  const grid = useContext(GridContext)
  if (grid === undefined) {
    throw new TallyError(
      'invalid_value',
      'useGridContext must be used inside a GridContext.Provider',
    )
  }
  return grid
}
