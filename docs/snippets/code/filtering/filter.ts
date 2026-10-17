import { and, condition, createArraySource, createGrid, createSchema, parseQuery } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
  ],
})

const source = createArraySource(
  [{ id: 1, account: 'Acme', plan: 'pro', mrr: 4200, renewal: '2026-11-02' }],
  schema,
)

const grid = createGrid({
  schema,
  source,
  flags: (name, row) => name === 'enterprise' && Number(row['mrr']) >= 10_000,
})

grid.view.setFilter(parseQuery('plan is pro or team, renewal next 30 days', schema).query.filter)

grid.view.setFilter(and(condition('plan', 'in', ['pro', 'team']), condition('mrr', 'gt', 2000)))

await grid.load()

export const matched = grid.get().matched
