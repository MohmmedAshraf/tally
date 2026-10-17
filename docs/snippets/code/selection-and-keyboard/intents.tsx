import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { Tally } from 'tally-react'

export function Accounts({
  grid,
  openPalette,
}: {
  grid: Grid
  openPalette: () => void
}): ReactNode {
  return (
    <Tally
      grid={grid}
      label="Accounts"
      onIntent={(intent) => {
        if (intent.type === 'commandPalette') {
          openPalette()
          return true
        }
        return undefined
      }}
    />
  )
}
