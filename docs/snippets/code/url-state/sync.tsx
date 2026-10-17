import type { ReactNode } from 'react'
import type { DataSource, Schema } from 'tally-core'
import { Tally, useGrid, useViewUrl } from 'tally-react'

export function Accounts({ schema, source }: { schema: Schema; source: DataSource }): ReactNode {
  const grid = useGrid({ schema, source })
  useViewUrl(grid, { param: 'accounts', history: 'push' })
  return <Tally grid={grid} label="Accounts" />
}
