import { createArraySource, createGrid, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
    { id: 'renewal', type: 'date' },
  ],
})

const source = createArraySource(
  [
    { id: 1, account: 'Acme', mrr: 4200, renewal: '2026-11-02' },
    { id: 2, account: 'Globex', mrr: 1800, renewal: '2027-01-20' },
  ],
  schema,
)

const grid = createGrid({ schema, source })

grid.view.setGroup('renewal', 'quarter')
grid.view.setFooter('mrr', 'avg')
await grid.load()

export const groups = grid.get().groups?.map((group) => ({
  key: group.key,
  count: group.count,
  mrr: group.aggregates['mrr:avg'],
}))

export const total = grid.get().aggregates?.['mrr:avg']
