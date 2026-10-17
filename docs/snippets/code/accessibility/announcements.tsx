import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { Tally, type TallyLabels } from 'tally-react'

const labels: Partial<TallyLabels> = {
  sorted: (sorts) =>
    sorts.length === 0
      ? 'Sorting removed'
      : `Now sorted by ${sorts.map((sort) => sort.column).join(' then ')}`,
  filtered: (filter) => (filter === undefined ? 'Showing every row' : `Showing ${filter}`),
  rows: (count) => `${count} matching rows`,
}

export function Accounts({ grid }: { grid: Grid }): ReactNode {
  return <Tally grid={grid} label="Accounts" labels={labels} />
}
