import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { Tally, type DetailRenderer } from 'tally-react'

const detail: DetailRenderer = ({ grid, item, close }) => (
  <section>
    <p>{typeof item.row['notes'] === 'string' ? item.row['notes'] : ''}</p>
    <button
      type="button"
      onClick={() => {
        void grid.deleteRows([item.key])
        close()
      }}
    >
      Delete
    </button>
  </section>
)

export function Accounts({ grid }: { grid: Grid }): ReactNode {
  return <Tally grid={grid} label="Accounts" layout="auto" cardsBelow={720} detail={detail} />
}
