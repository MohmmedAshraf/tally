import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState, useView } from 'tally-react'

export function Status({ grid }: { grid: Grid }): ReactNode {
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  const sorted = useView(grid, (view) => view.sort.length > 0)
  return (
    <p>
      {matched ?? '…'} rows{sorted ? ', sorted' : ''}
    </p>
  )
}
