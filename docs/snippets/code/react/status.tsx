import type { ReactNode } from 'react'
import { useGridContext, useGridState, useView } from 'tally-react'

export function Status(): ReactNode {
  const grid = useGridContext()
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  const sorted = useView(grid, (view) => view.sort[0]?.column)
  return (
    <p>
      {matched ?? 0} rows, sorted by {sorted ?? 'nothing'}
    </p>
  )
}
