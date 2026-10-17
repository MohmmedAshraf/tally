import { createArraySource, createGrid, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'notes', sortable: false },
  ],
})

const grid = createGrid({ schema, source: createArraySource([], schema) })

grid.view.toggleSort('plan')
grid.view.toggleSort('mrr', true)

export const sort = grid.view.get().sort

grid.view.setSort([{ column: 'account', direction: 'asc' }])
