import { createArraySource, createGrid, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'mrr', label: 'MRR', type: 'currency' }],
})
const source = createArraySource([{ id: 1, account: 'Acme', mrr: 4200 }], schema)
const grid = createGrid({ schema, source })
await grid.load()

await grid.setCells([{ key: 1, column: 'mrr', value: '$5k' }])
await grid.insertRows([{ id: 2, account: 'Globex', mrr: 1800 }])
await grid.deleteRows([1])

export const labels = grid.rows.history().map((mutation) => mutation.label)

await grid.undo()
