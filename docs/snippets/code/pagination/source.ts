import { createArraySource, createGrid, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'mrr', type: 'currency' }],
})

const rows = Array.from({ length: 500 }, (_, index) => ({
  id: index + 1,
  account: `Account ${index + 1}`,
  mrr: (index + 1) * 10,
}))

const source = createArraySource(rows, schema, { pagination: 'offset' })

export const grid = createGrid({ schema, source, pageSize: 50 })

await grid.load()
grid.setPage(2)
