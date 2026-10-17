import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { DisplayMenu, FilterBar, Pager, Tally } from 'tally-react'

export function Accounts({ grid }: { grid: Grid }): ReactNode {
  return (
    <Tally
      grid={grid}
      label="Accounts"
      toolbar={
        <div className="accounts-toolbar">
          <FilterBar grid={grid} />
          <DisplayMenu grid={grid} />
          <Pager grid={grid} />
        </div>
      }
    />
  )
}
