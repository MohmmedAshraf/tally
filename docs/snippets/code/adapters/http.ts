import { HttpSourceError, createHttpSource, fetchSchema } from 'tally-adapters'
import { createSchema, parseQuery, type QueryResponse } from 'tally-core'

const transport = { url: '/api/accounts', headers: { 'x-team': 'growth' } }

const remote = await fetchSchema(transport)
const schema = createSchema({ columns: remote.columns, key: remote.key })
const source = createHttpSource({ ...transport, capabilities: remote.capabilities })

export async function overdue(): Promise<QueryResponse | undefined> {
  const { query } = parseQuery('renewal last 30 days, sort by renewal', schema)
  try {
    return await source.query({ version: 1, ...query })
  } catch (error) {
    if (error instanceof HttpSourceError && error.status === 400) return undefined
    throw error
  }
}
