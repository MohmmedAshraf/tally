import type { ReactNode } from 'react'
import type { Grid, RowData } from 'tally-core'
import { Tally, type IntentHandler } from 'tally-react'

export function Accounts({
  grid,
  inspect,
}: {
  grid: Grid
  inspect: (row: RowData) => void
}): ReactNode {
  const onIntent: IntentHandler = (intent) => {
    if (intent.type === 'cut' || intent.type === 'clearCells') return true
    if (intent.type !== 'inspect') return undefined
    const active = grid.selection.get().active
    const item = active === undefined ? undefined : grid.model().rows[active.row]
    if (item !== undefined) inspect(item.row)
    return true
  }
  return <Tally grid={grid} label="Accounts" onIntent={onIntent} />
}
