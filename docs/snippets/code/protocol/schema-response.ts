import type { SchemaResponse } from 'tally-protocol'

export const schemaResponse: SchemaResponse = {
  version: 1,
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', type: 'text' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
  ],
  capabilities: {
    filter: true,
    sort: true,
    group: true,
    search: true,
    aggregates: true,
    facets: true,
    pagination: 'offset',
    mutate: true,
    live: true,
  },
}
