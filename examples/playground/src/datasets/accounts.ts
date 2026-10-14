import { Building2 } from 'lucide-react'
import { createSchema, type Column, type RowData } from 'tally-core'
import { addDays, pick, random, weighted, TEAM, TODAY } from './shared.ts'
import type { Dataset } from './dataset.ts'

const PREFIX = [
  'North',
  'Blue',
  'Iron',
  'Quiet',
  'Bright',
  'Cedar',
  'Polar',
  'Atlas',
  'Copper',
  'Hollow',
  'Lumen',
  'Vector',
  'Kite',
  'Orbit',
  'Granite',
  'Harbor',
  'Signal',
  'Tandem',
  'Meridian',
  'Fable',
  'Juniper',
  'Basalt',
  'Saffron',
  'Delta',
]
const SUFFIX = [
  'Labs',
  'Works',
  'Systems',
  'Analytics',
  'Cloud',
  'Health',
  'Logistics',
  'Studio',
  'Bank',
  'Robotics',
  'Foods',
  'Energy',
  'Supply',
  'Partners',
]
const NOTES = [
  '',
  '',
  'Renewal moved to March after the procurement review; legal wants the DPA addendum before signature.',
  'Champion left in September. New sponsor is the VP Design, first call booked.',
  'Needs SSO before the trial converts.',
  'Invoice bounced twice, AP contact changed.',
  'Expanding to a second business unit in Q1.',
]
const BASE: Readonly<Record<string, number>> = {
  free: 0,
  starter: 290,
  pro: 1200,
  team: 3900,
  enterprise: 14000,
}

const accountColumns: readonly Column[] = [
  {
    id: 'account',
    label: 'Account',
    type: 'text',
    width: 224,
    pin: 'left',
    card: 'title',
    avatar: true,
    subtitle: 'domain',
  },
  { id: 'domain', label: 'Domain', type: 'text', width: 180, hidden: true, card: 'hidden' },
  { id: 'owner', label: 'Owner', type: 'person', width: 160, aggregate: 'distinct', card: 'meta' },
  {
    id: 'plan',
    label: 'Plan',
    type: 'enum',
    width: 120,
    options: [
      { value: 'enterprise', label: 'Enterprise' },
      { value: 'team', label: 'Team' },
      { value: 'pro', label: 'Pro' },
      { value: 'starter', label: 'Starter' },
      { value: 'free', label: 'Free' },
    ],
    aggregate: 'count',
    card: 'badge',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'enum',
    width: 120,
    options: [
      { value: 'active', label: 'Active', color: 'oklch(0.62 0.14 150)' },
      { value: 'trial', label: 'Trial', color: 'oklch(0.62 0.13 250)' },
      { value: 'past_due', label: 'Past due', color: 'oklch(0.7 0.16 60)' },
      { value: 'churned', label: 'Churned', color: 'oklch(0.62 0.01 80)' },
    ],
    aggregate: 'count',
    card: 'badge',
  },
  {
    id: 'mrr',
    label: 'MRR',
    type: 'currency',
    width: 120,
    format: { currency: 'USD', fractionDigits: 0 },
    aggregate: 'sum',
    card: 'metric',
  },
  {
    id: 'growth',
    label: 'Growth',
    type: 'percent',
    width: 150,
    format: { signed: true, fractionDigits: 1 },
    aggregate: 'avg',
    card: 'metric',
    sparkline: 'history',
  },
  {
    id: 'health',
    label: 'Health',
    type: 'bar',
    width: 140,
    aggregate: 'avg',
  },
  {
    id: 'renewal',
    label: 'Renewal',
    type: 'date',
    width: 130,
    aggregate: 'min',
    card: 'meta',
    relative: true,
  },
  { id: 'seats', label: 'Seats', type: 'int', width: 90, aggregate: 'sum' },
  {
    id: 'region',
    label: 'Region',
    type: 'enum',
    width: 110,
    options: [
      { value: 'na', label: 'NA' },
      { value: 'emea', label: 'EMEA' },
      { value: 'apac', label: 'APAC' },
      { value: 'latam', label: 'LATAM' },
    ],
  },
  { id: 'notes', label: 'Notes', type: 'text', width: 320, flex: 1 },
  { id: 'site', label: 'Website', type: 'url', width: 180 },
]

function history(mrr: number, growth: number, next: () => number): number[] {
  const start = 1 / (1 + Math.max(-0.9, growth / 100))
  return Array.from({ length: 12 }, (_, index) => {
    const t = index / 11
    const trend = start + (1 - start) * (t * 0.65 + t * t * 0.35)
    const noise = index < 11 ? (next() - 0.5) * 0.09 : 0
    return Math.round(trend * (1 + noise) * mrr)
  })
}

function makeAccounts(count: number): RowData[] {
  const next = random(7)
  const used = new Set<string>()
  return Array.from({ length: count }, (_, index) => {
    let name = `${pick(next, PREFIX)} ${pick(next, SUFFIX)}`
    if (used.has(name)) name = `${name} ${Math.floor(next() * 90 + 10)}`
    used.add(name)
    const plan = weighted(next, [
      ['free', 18],
      ['starter', 27],
      ['pro', 28],
      ['team', 17],
      ['enterprise', 10],
    ] as const)
    const status =
      plan === 'free'
        ? weighted(next, [
            ['active', 6],
            ['trial', 4],
            ['churned', 1],
          ] as const)
        : weighted(next, [
            ['active', 70],
            ['trial', 10],
            ['past_due', 9],
            ['churned', 11],
          ] as const)
    const base = BASE[plan] ?? 0
    const mrr =
      status === 'churned' || plan === 'free'
        ? 0
        : Math.round((base * (0.6 + next() * 1.3)) / 10) * 10
    const growth = status === 'churned' ? -100 : Math.round((next() * 80 - 24) * 10) / 10
    const domain = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return {
      id: index + 1,
      account: name,
      domain: `${domain}.com`,
      owner: pick(next, TEAM),
      plan,
      status,
      mrr,
      growth,
      history: history(mrr, growth, next),
      health: Math.round(
        status === 'churned'
          ? next() * 25
          : status === 'past_due'
            ? 15 + next() * 40
            : 35 + next() * 65,
      ),
      renewal: addDays(TODAY, Math.floor(next() * 360) - 20),
      seats:
        plan === 'free'
          ? 1 + Math.floor(next() * 4)
          : Math.max(2, Math.round((base / 45) * (0.5 + next() * 1.4))),
      region: weighted(next, [
        ['na', 40],
        ['emea', 33],
        ['apac', 18],
        ['latam', 9],
      ] as const),
      notes: pick(next, NOTES),
      site: `https://${domain}.com`,
    }
  })
}

export const accounts: Dataset = {
  id: 'accounts',
  title: 'Accounts',
  unit: 'accounts',
  icon: Building2,
  schema: createSchema({ columns: accountColumns, key: 'id' }),
  rows: makeAccounts(5000),
  views: [
    { name: 'All accounts', query: '' },
    { name: 'At risk', query: 'health < 40 and status is not churned, sort by health asc' },
    { name: 'Enterprise by owner', query: 'plan is enterprise or team, group by owner' },
  ],
  examples: [
    'plan is pro or team and mrr > 2k',
    'status is past due',
    'renewal next 60 days',
    'growth < 0 and region is emea',
    'sort by health asc',
    'group by plan',
  ],
  remote: true,
  live: true,
}
