import { createSchema, createViewStore, parseQuery } from 'tally-core'

const schema = createSchema({
  columns: [{ id: 'account' }, { id: 'mrr', type: 'currency' }, { id: 'renewal', type: 'date' }],
})

export const view = createViewStore(schema)

view.setFilter(parseQuery('mrr > 2k', schema).query.filter)
view.toggleSort('mrr')
view.setGroup('renewal', 'quarter')
view.pinColumn('account', 'left')
view.setFooter('mrr', 'sum')
view.setDensity('compact')
