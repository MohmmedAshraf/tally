import type { QueryRequest, QueryResponse } from 'tally-core'

export const request: QueryRequest = {
  version: 1,
  filter: { type: 'condition', column: 'mrr', op: 'gt', value: 2000 },
  sort: [{ column: 'mrr', direction: 'desc' }],
  group: { column: 'plan' },
  page: { offset: 0, limit: 100 },
  aggregates: [{ column: 'mrr', fn: 'sum' }],
  facets: ['plan'],
}

export const response: QueryResponse = {
  rows: [{ id: 7, account: 'Acme', plan: 'pro', mrr: 4200 }],
  total: 1240,
  matched: 1,
  groups: [{ key: 'pro', value: 'pro', count: 1, aggregates: { 'mrr:sum': 4200 } }],
  aggregates: { 'mrr:sum': 4200 },
  facets: {
    plan: { kind: 'terms', terms: [{ value: 'pro', count: 1 }], distinct: 1 },
  },
}
