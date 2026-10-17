import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useRows } from 'tally-react'

export function ChangedCount({ grid }: { grid: Grid }): ReactNode {
  const { changed } = useRows(grid)
  return <span>{changed.size} rows changed</span>
}
