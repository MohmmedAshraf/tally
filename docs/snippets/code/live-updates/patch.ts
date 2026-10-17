import { createArraySource, createSchema } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'service' }, { id: 'latency', type: 'int' }],
})

export const source = createArraySource([{ id: 1, service: 'api', latency: 120 }], schema)

source.patch({
  upserts: [
    { id: 1, service: 'api', latency: 95 },
    { id: 2, service: 'worker', latency: 40 },
  ],
})

source.patch({ deletes: [2] })
