import { addDays, createSchema, type ColumnInput, type RowData, type Schema } from 'tally-core'

export const CONFORMANCE_TODAY = '2026-03-15'

export const conformanceColumns: readonly ColumnInput[] = [
  { id: 'id', type: 'id' },
  { id: 'account', type: 'text' },
  { id: 'owner', type: 'person' },
  {
    id: 'plan',
    type: 'enum',
    options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }],
  },
  { id: 'mrr', type: 'currency', aggregate: 'sum' },
  { id: 'seats', type: 'int' },
  { id: 'score', type: 'number' },
  { id: 'growth', type: 'percent' },
  { id: 'health', type: 'bar' },
  { id: 'renewal', type: 'date' },
  { id: 'active', type: 'bool' },
  { id: 'email', type: 'email' },
  { id: 'website', type: 'url' },
  { id: 'tenure', type: 'duration' },
]

const ACCOUNTS = [
  'acme',
  'Beacon',
  'cobalt',
  'Delta',
  'echo',
  'Fjord',
  'gamma',
  'Helix',
  'ion',
  'Juno',
  'kilo',
  'Lumen',
]

const OWNERS = ['Mona', 'Omar', 'Lena', null, 'Yusuf', '']

const PLANS = ['free', 'pro', 'team', 'pro', 'free', 'team', null]

function pick<T>(list: readonly T[], index: number, fallback: T): T {
  return list[index % list.length] ?? fallback
}

function every(index: number, period: number): boolean {
  return index % period === 0
}

function row(index: number): RowData {
  const account = pick(ACCOUNTS, index, 'acme')
  const slug = account.toLowerCase()
  return {
    id: `acc_${String(index + 1).padStart(3, '0')}`,
    account,
    owner: pick(OWNERS, index, null),
    plan: pick(PLANS, index, null),
    mrr: every(index, 9) ? null : ((index * 37) % 50) * 25,
    seats: every(index, 11) ? null : ((index * 7) % 40) + 1,
    score: every(index, 6) ? null : ((index * 53) % 1000) / 10,
    growth: every(index, 8) ? null : (((index * 29) % 200) - 100) / 1000,
    health: every(index, 10) ? null : (index * 13) % 101,
    renewal: every(index, 7) ? null : addDays('2025-06-01', (index * 23) % 480),
    active: every(index, 9) ? null : index % 3 !== 0,
    email: every(index, 13) ? '' : `${slug}${index}@example.com`,
    website: every(index, 5) ? null : `https://${slug}.example`,
    tenure: every(index, 12) ? null : (index * 97) % 5000,
  }
}

export const conformanceRows: readonly RowData[] = Array.from({ length: 60 }, (_, index) =>
  row(index),
)

export const conformanceSchema: Schema = createSchema({ columns: conformanceColumns, key: 'id' })
