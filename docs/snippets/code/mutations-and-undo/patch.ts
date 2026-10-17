import { createArraySource, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'mrr', type: 'currency' }],
})

export const source = createArraySource([{ id: 1, account: 'Acme', mrr: 4200 }], schema)

source.patch({ upserts: [{ id: 1, account: 'Acme', mrr: 4600 }], deletes: [] })
