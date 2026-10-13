import type { Column, RowData } from 'tally-core'

export const columns: Column[] = [
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
    group: 'Revenue',
    card: 'metric',
  },
  {
    id: 'growth',
    label: 'Growth',
    type: 'percent',
    width: 150,
    format: { signed: true, fractionDigits: 1 },
    aggregate: 'avg',
    group: 'Revenue',
    card: 'metric',
    sparkline: 'history',
  },
  {
    id: 'health',
    label: 'Health',
    type: 'bar',
    width: 140,
    aggregate: 'avg',
    group: 'Account health',
  },
  {
    id: 'renewal',
    label: 'Renewal',
    type: 'date',
    width: 130,
    aggregate: 'min',
    group: 'Account health',
    card: 'meta',
    relative: true,
  },
  { id: 'seats', label: 'Seats', type: 'int', width: 90, aggregate: 'sum' },
  { id: 'notes', label: 'Notes', type: 'text', width: 320, wrap: true },
  { id: 'site', label: 'Website', type: 'url', width: 180 },
]

const NAMES = [
  'Kite',
  'Hollow',
  'Harbor',
  'Atlas',
  'Meridian',
  'Tandem',
  'Orbit',
  'Iron',
  'North',
  'Blue',
  'Cedar',
  'Lumen',
  'Quill',
  'Vector',
  'Summit',
]
const SUFFIX = [
  'Supply',
  'Systems',
  'Studio',
  'Labs',
  'Energy',
  'Bank',
  'Logistics',
  'Health',
  'Works',
  'Partners',
]
const OWNERS = [
  'Priya Reyes',
  'Sven Lindqvist',
  'Jonas Fischer',
  'Dara Novak',
  'Amara Osei',
  'Lucas Moreau',
]
const PLANS = ['enterprise', 'team', 'pro', 'free']
const STATUSES = ['active', 'active', 'active', 'trial', 'past_due', 'churned']
const NOTES = [
  '',
  'Renewal moved to March after the procurement review; legal wants the DPA addendum before signature.',
  'Champion left in September. New sponsor is the VP Design, first call booked.',
  'Needs SSO before the trial converts.',
  'Invoice bounced twice, AP contact changed.',
  'Expanding to a second business unit in Q1.',
]

function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function history(mrr: number, growth: number, next: () => number): number[] {
  const start = 1 / (1 + Math.max(-0.9, growth / 100))
  return Array.from({ length: 12 }, (_, index) => {
    const t = index / 11
    const trend = start + (1 - start) * (t * 0.65 + t * t * 0.35)
    const noise = index < 11 ? (next() - 0.5) * 0.09 : 0
    return Math.round(trend * (1 + noise) * mrr)
  })
}

export function makeRows(count: number): RowData[] {
  const next = random(7)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!
  return Array.from({ length: count }, (_, index) => {
    const name = `${pick(NAMES)} ${pick(SUFFIX)}`
    const plan = pick(PLANS)
    const base = plan === 'enterprise' ? 18000 : plan === 'team' ? 4000 : plan === 'pro' ? 900 : 0
    const day = new Date(Date.UTC(2026, 9, 13 + Math.floor(next() * 400)))
    const mrr = Math.round(base + next() * base * 0.6)
    const growth = Math.round((next() * 90 - 30) * 10) / 10
    const domain = name.toLowerCase().replace(/\s+/g, '')
    return {
      id: index + 1,
      account: name,
      domain: `${domain}.com`,
      owner: pick(OWNERS),
      plan,
      status: pick(STATUSES),
      mrr,
      growth,
      history: history(mrr, growth, next),
      health: Math.round(next() * 100),
      renewal: day.toISOString().slice(0, 10),
      seats: Math.round(next() * 400),
      notes: pick(NOTES),
      site: `https://${domain}.com`,
    }
  })
}
