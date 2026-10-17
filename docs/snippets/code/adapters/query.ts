import { QueryClient } from '@tanstack/query-core'
import { connectHttpSource } from 'tally-adapters'
import { createQuerySource } from 'tally-adapters/query'

const client = new QueryClient()
const remote = await connectHttpSource({ url: '/api/accounts' })

export const schema = remote.schema

export const source = createQuerySource({
  client,
  source: remote.source,
  queryKey: ['accounts'],
  staleTime: 30_000,
  gcTime: 300_000,
})
