import { createSchema } from 'tally-core'

export const schema = createSchema({
  key: 'id',
  parent: 'parentId',
  columns: [{ id: 'title' }, { id: 'progress', type: 'bar' }],
})
