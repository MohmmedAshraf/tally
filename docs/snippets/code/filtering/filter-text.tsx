import type { ReactNode } from 'react'
import { printQuery, type Grid } from 'tally-core'
import { useView } from 'tally-react'

export function FilterText({ grid }: { grid: Grid }): ReactNode {
  const filter = useView(grid, (view) => view.filter)
  return <code>{printQuery({ filter, sort: [] }, grid.schema)}</code>
}
