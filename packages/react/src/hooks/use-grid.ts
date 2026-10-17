import { useEffect, useState } from 'react'
import { holdGrid, type Grid, type GridOptions, type HeldGrid } from 'tally-core'

export function useGrid(options: GridOptions): Grid {
  const [held, setHeld] = useState<HeldGrid>(() => holdGrid(options))
  const current = holdGrid(options, held)
  if (current !== held) setHeld(current)
  const { grid } = current
  useEffect(() => {
    void grid.load()
    return () => grid.dispose()
  }, [grid])
  return grid
}
