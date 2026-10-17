import { createSchema } from 'tally-core'

export const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', pin: 'left', width: 240 },
    { id: 'owner', type: 'person', aliases: ['rep', 'manager'] },
    {
      id: 'status',
      type: 'enum',
      options: [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'past_due', label: 'Past due', color: 'amber' },
        { value: 'churned', label: 'Churned' },
      ],
    },
    { id: 'mrr', label: 'MRR', type: 'currency', format: { compact: true }, aggregate: 'sum' },
    { id: 'notes', wrap: true, sortable: false, hidden: true },
  ],
})
