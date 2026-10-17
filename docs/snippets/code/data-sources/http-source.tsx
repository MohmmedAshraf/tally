import type { ReactNode } from 'react'
import { connectHttpSource } from 'tally-adapters'
import { Tally, useGrid } from 'tally-react'

const { schema, source } = await connectHttpSource({
  url: '/api/accounts',
  headers: () => ({ authorization: `Bearer ${sessionStorage.getItem('token') ?? ''}` }),
})

export function Accounts(): ReactNode {
  const grid = useGrid({ schema, source })
  return <Tally grid={grid} label="Accounts" />
}
