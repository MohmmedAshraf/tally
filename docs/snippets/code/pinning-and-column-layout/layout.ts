import { createSchema, createViewStore, layoutColumns } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'owner' }, { id: 'mrr', type: 'currency' }],
})

const view = createViewStore(schema)

view.pinColumn('account', 'left')
view.moveColumn('mrr', 1)
view.resizeColumn('owner', 240)
view.setColumnFlex('mrr', 1)
view.togglePinnedRow(42)

export const layout = layoutColumns(view.get(), schema, 1200)
