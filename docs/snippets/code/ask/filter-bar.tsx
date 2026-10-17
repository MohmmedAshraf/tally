import type { LanguageModel } from 'ai'
import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { createAskHandler } from 'tally-ai'
import { Tally } from 'tally-react'

export function Accounts({ grid, model }: { grid: Grid; model: LanguageModel }): ReactNode {
  const ai = { ask: createAskHandler({ model }) }
  return <Tally grid={grid} label="Accounts" ai={ai} />
}
