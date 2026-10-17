import { createSchema } from 'tally-core'

export const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', avatar: true, subtitle: 'domain' },
    { id: 'domain', card: 'hidden' },
    {
      id: 'plan',
      type: 'enum',
      options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }],
    },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'seats', type: 'int', card: 'meta' },
    { id: 'renewal', type: 'date', relative: true },
    { id: 'notes', wrap: true, card: 'meta' },
  ],
})
