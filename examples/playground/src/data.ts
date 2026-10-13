import type { Column, RowData } from 'tally-core'

export const columns: Column[] = [
  { id: 'account', label: 'Account', type: 'text', width: 224, pin: 'left', card: 'title' },
  { id: 'owner', label: 'Owner', type: 'person', width: 160, card: 'meta' },
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
    width: 120,
    format: { signed: true, fractionDigits: 1 },
    aggregate: 'avg',
    group: 'Revenue',
    card: 'metric',
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

export function makeRows(count: number): RowData[] {
  const next = random(7)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!
  return Array.from({ length: count }, (_, index) => {
    const name = `${pick(NAMES)} ${pick(SUFFIX)}`
    const plan = pick(PLANS)
    const base = plan === 'enterprise' ? 18000 : plan === 'team' ? 4000 : plan === 'pro' ? 900 : 0
    const day = new Date(Date.UTC(2026, 9, 13 + Math.floor(next() * 400)))
    return {
      id: index + 1,
      account: name,
      owner: pick(OWNERS),
      plan,
      status: pick(STATUSES),
      mrr: Math.round(base + next() * base * 0.6),
      growth: Math.round((next() * 90 - 30) * 10) / 10,
      health: Math.round(next() * 100),
      renewal: day.toISOString().slice(0, 10),
      seats: Math.round(next() * 400),
      notes: pick(NOTES),
      site: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
    }
  })
}
