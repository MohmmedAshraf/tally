import { createArraySource, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'renewal', type: 'date' }],
})

export const source = createArraySource(
  [{ id: 1, account: 'Acme', renewal: '2026-11-02' }],
  schema,
  {
    mutable: false,
    pagination: 'offset',
    today: '2026-10-17',
  },
)
