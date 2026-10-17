import { createSchema, createViewStore, viewFromUrlString, viewToUrlString } from 'tally-core'

const schema = createSchema({
  columns: [{ id: 'status' }, { id: 'mrr', type: 'currency' }, { id: 'renewal', type: 'date' }],
})
const view = createViewStore(schema)

export const search = viewToUrlString(view.get(), schema)

view.set(viewFromUrlString(search, schema))
