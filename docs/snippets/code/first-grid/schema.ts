import { createSchema } from 'tally-core'

export const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', pin: 'left' },
    { id: 'owner', type: 'person' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
    { id: 'growth', type: 'percent' },
    { id: 'renewal', type: 'date' },
  ],
})
