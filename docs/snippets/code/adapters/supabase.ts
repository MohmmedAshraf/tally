import { createClient } from '@supabase/supabase-js'
import { createSchema } from 'tally-core'
import { createSupabaseSource } from 'tally-adapters/supabase'

const client = createClient(
  process.env['SUPABASE_URL'] ?? '',
  process.env['SUPABASE_ANON_KEY'] ?? '',
)

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
  ],
})

export const source = createSupabaseSource({
  client,
  table: 'accounts',
  schema,
  columns: { renewal: 'renews_on' },
  pagination: 'cursor',
})
