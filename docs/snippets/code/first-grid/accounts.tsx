import { useState, type ReactNode } from 'react'
import { createArraySource } from 'tally-core'
import { Tally, useGrid } from 'tally-react'
import 'tally-react/styles.css'
import { rows } from './rows'
import { schema } from './schema'

export function Accounts(): ReactNode {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({ schema, source })
  return <Tally grid={grid} label="Accounts" />
}
