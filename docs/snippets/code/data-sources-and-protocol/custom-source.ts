import type { DataSource } from 'tally-core'
import { queryResponseSchema } from 'tally-protocol'

export const source: DataSource = {
  capabilities: {
    filter: false,
    sort: false,
    group: false,
    search: false,
    aggregates: false,
    facets: false,
    pagination: 'none',
    mutate: false,
    live: false,
  },
  async query(_request, signal) {
    const response = await fetch('/api/accounts', { signal: signal ?? null })
    return queryResponseSchema.parse(await response.json())
  },
}
