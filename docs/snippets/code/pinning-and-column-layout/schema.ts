import { createSchema } from 'tally-core'

export const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', pin: 'left', width: 220, minWidth: 160 },
    { id: 'owner', type: 'person', flex: 1 },
    { id: 'mrr', label: 'MRR', type: 'currency', group: 'Revenue' },
    { id: 'growth', type: 'percent', group: 'Revenue' },
    { id: 'renewal', type: 'date', maxWidth: 180 },
    { id: 'notes', hidden: true },
    { id: 'health', type: 'number', pin: 'right', width: 96 },
  ],
})
