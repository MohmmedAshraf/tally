import { and, condition, createSchema, not, or, printFilter, search } from 'tally-core'

const schema = createSchema({
  columns: [
    { id: 'account' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }] },
    { id: 'mrr', type: 'currency' },
  ],
})

export const filter = and(
  search('acme'),
  or(condition('plan', 'eq', 'pro'), condition('mrr', 'gt', 1000)),
  not(condition('plan', 'eq', 'free')),
)

export const text = printFilter(filter, schema)
