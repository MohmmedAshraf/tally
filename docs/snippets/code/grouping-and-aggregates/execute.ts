import { createSchema, execute } from 'tally-core'

const schema = createSchema({
  columns: [
    { id: 'plan', type: 'enum', options: [{ value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', type: 'currency' },
  ],
})

const result = execute(
  [
    { id: 1, plan: 'pro', mrr: 4200 },
    { id: 2, plan: 'team', mrr: 9100 },
    { id: 3, plan: 'pro', mrr: 1800 },
  ],
  { group: { column: 'plan' }, aggregates: [{ column: 'mrr', fn: 'sum' }] },
  schema,
)

export const totals = result.groups?.map((group) => [group.key, group.aggregates['mrr:sum']])
