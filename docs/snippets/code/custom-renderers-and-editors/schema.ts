import { createSchema } from 'tally-core'

export const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', avatar: true, subtitle: 'domain', width: 200, flex: 2 },
    { id: 'domain', hidden: true },
    { id: 'growth', type: 'percent', sparkline: 'trend', format: { signed: true } },
    { id: 'health', type: 'bar' },
    { id: 'renewal', type: 'date', relative: true },
  ],
})
