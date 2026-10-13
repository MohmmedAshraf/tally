import { createContext, useContext, type ReactNode } from 'react'
import { TallyError, type Grid } from 'tally-core'

const GridContext = createContext<Grid | undefined>(undefined)

export interface GridProviderProps {
  readonly grid: Grid
  readonly children?: ReactNode
}

export function GridProvider({ grid, children }: GridProviderProps): ReactNode {
  return <GridContext value={grid}>{children}</GridContext>
}

export function useGridContext(): Grid {
  const grid = useContext(GridContext)
  if (grid === undefined) {
    throw new TallyError('invalid_value', 'useGridContext must be used inside a GridProvider')
  }
  return grid
}
