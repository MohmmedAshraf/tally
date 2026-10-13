import { useEffect, useState } from 'react'
import { createGrid, type Grid, type GridOptions } from 'tally-core'

export function useGrid(options: GridOptions): Grid {
  const [grid, setGrid] = useState(() => createGrid(options))
  let current = grid
  if (grid.schema !== options.schema || grid.source !== options.source) {
    current = createGrid(options)
    setGrid(current)
  }
  useEffect(() => {
    void current.load()
    return () => current.dispose()
  }, [current])
  return current
}
