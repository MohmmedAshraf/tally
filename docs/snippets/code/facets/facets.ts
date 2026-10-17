import { computeFacets, createExecutionContext, createSchema } from 'tally-core'

const schema = createSchema({
  columns: [
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', type: 'currency' },
  ],
})

const rows = [
  { id: 1, plan: 'pro', mrr: 4200 },
  { id: 2, plan: 'team', mrr: 9100 },
  { id: 3, plan: 'pro', mrr: 1800 },
]

export const facets = computeFacets(rows, ['plan', 'mrr'], schema, createExecutionContext(), {
  bins: 4,
  maxTerms: 10,
})
