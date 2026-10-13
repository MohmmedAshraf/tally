import { ArrowLeftRight } from 'lucide-react'
import { createSchema, type Column, type RowData } from 'tally-core'
import { addDays, random, weighted, TODAY } from './shared.ts'
import type { Dataset } from './dataset.ts'

interface Merchant {
  readonly name: string
  readonly category: string
  readonly low: number
  readonly high: number
  readonly weight: number
}

const MERCHANTS: readonly Merchant[] = [
  { name: 'AWS', category: 'infrastructure', low: -9000, high: -1800, weight: 3 },
  { name: 'Hetzner', category: 'infrastructure', low: -900, high: -200, weight: 3 },
  { name: 'Datadog', category: 'infrastructure', low: -2400, high: -600, weight: 2 },
  { name: 'Vercel', category: 'infrastructure', low: -800, high: -150, weight: 3 },
  { name: 'Figma', category: 'software', low: -900, high: -45, weight: 3 },
  { name: 'Linear', category: 'software', low: -400, high: -80, weight: 3 },
  { name: 'Notion', category: 'software', low: -600, high: -96, weight: 3 },
  { name: 'GitHub', category: 'software', low: -1200, high: -210, weight: 3 },
  { name: 'Slack', category: 'software', low: -1500, high: -300, weight: 2 },
  { name: 'Delta Air Lines', category: 'travel', low: -1900, high: -240, weight: 4 },
  { name: 'Airbnb', category: 'travel', low: -2600, high: -180, weight: 3 },
  { name: 'Uber', category: 'travel', low: -90, high: -12, weight: 14 },
  { name: 'Gusto Payroll', category: 'payroll', low: -98000, high: -62000, weight: 1 },
  { name: 'Google Ads', category: 'marketing', low: -7000, high: -500, weight: 4 },
  { name: 'LinkedIn Ads', category: 'marketing', low: -4000, high: -300, weight: 3 },
  { name: 'WeWork', category: 'office', low: -6400, high: -6400, weight: 1 },
  { name: 'Office Depot', category: 'office', low: -420, high: -20, weight: 4 },
  { name: 'Blue Bottle', category: 'meals', low: -60, high: -6, weight: 16 },
  { name: 'Sweetgreen', category: 'meals', low: -180, high: -14, weight: 12 },
  { name: 'Stripe payout', category: 'revenue', low: 4000, high: 48000, weight: 8 },
  { name: 'Wire · Northwind', category: 'revenue', low: 12000, high: 90000, weight: 2 },
  { name: 'Stripe fees', category: 'fees', low: -1400, high: -80, weight: 4 },
  { name: 'Toptal', category: 'contractors', low: -14000, high: -2200, weight: 2 },
  { name: 'Upwork', category: 'contractors', low: -3000, high: -300, weight: 3 },
]

const CATEGORIES = [
  'revenue',
  'payroll',
  'infrastructure',
  'software',
  'marketing',
  'contractors',
  'travel',
  'office',
  'meals',
  'fees',
]

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const ledgerColumns: readonly Column[] = [
  { id: 'date', label: 'Date', type: 'date', width: 150, pin: 'left', card: 'meta' },
  { id: 'ref', label: 'Ref', type: 'id', width: 110 },
  { id: 'merchant', label: 'Merchant', type: 'text', width: 200, card: 'title' },
  {
    id: 'category',
    label: 'Category',
    type: 'enum',
    width: 150,
    options: CATEGORIES.map((value) => ({ value, label: label(value) })),
    aggregate: 'count',
    card: 'badge',
  },
  {
    id: 'account',
    label: 'Account',
    type: 'enum',
    width: 140,
    options: [
      { value: 'operating', label: 'Operating' },
      { value: 'payroll', label: 'Payroll' },
      { value: 'amex', label: 'Amex ·4021' },
      { value: 'brex', label: 'Brex ·7730' },
    ],
    card: 'meta',
  },
  {
    id: 'amount',
    label: 'Amount',
    type: 'currency',
    width: 140,
    format: { currency: 'USD', fractionDigits: 2, signed: true },
    aggregate: 'sum',
    card: 'metric',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'enum',
    width: 120,
    options: [
      { value: 'cleared', label: 'Cleared', color: 'oklch(0.62 0.14 150)' },
      { value: 'pending', label: 'Pending', color: 'oklch(0.7 0.16 60)' },
      { value: 'flagged', label: 'Flagged', color: 'oklch(0.6 0.19 28)' },
    ],
    aggregate: 'count',
    card: 'badge',
  },
]

function makeLedger(count: number): RowData[] {
  const next = random(11)
  const pairs = MERCHANTS.map((merchant) => [merchant, merchant.weight] as const)
  return Array.from({ length: count }, (_, index) => {
    const merchant = weighted(next, pairs)
    const low = Math.min(merchant.low, merchant.high)
    const high = Math.max(merchant.low, merchant.high)
    const amount = Math.round((low + (high - low) * next() ** 1.6) * 100) / 100
    const account =
      merchant.category === 'payroll'
        ? 'payroll'
        : merchant.category === 'revenue' || merchant.category === 'fees'
          ? 'operating'
          : weighted(next, [
              ['amex', 5],
              ['brex', 3],
              ['operating', 2],
            ] as const)
    const day = Math.floor((index / count) * 365)
    return {
      id: index + 1,
      date: addDays(TODAY, -day),
      ref: `TX-${240000 + count - index}`,
      merchant: merchant.name,
      category: merchant.category,
      account,
      amount,
      status:
        day < 6
          ? weighted(next, [
              ['pending', 6],
              ['cleared', 3],
              ['flagged', 1],
            ] as const)
          : weighted(next, [
              ['cleared', 95],
              ['flagged', 3],
              ['pending', 2],
            ] as const),
    }
  })
}

export const ledger: Dataset = {
  id: 'transactions',
  title: 'Transactions',
  unit: 'transactions',
  icon: ArrowLeftRight,
  schema: createSchema({ columns: ledgerColumns, key: 'id' }),
  rows: makeLedger(12000),
  views: [
    { name: 'All transactions', query: 'sort by date desc' },
    { name: 'By category', query: 'sort by amount asc, group by category' },
    { name: 'Large outflows', query: 'amount < -5k, sort by amount asc' },
  ],
  examples: [
    'amount < -1k and status is pending',
    'category is travel or meals',
    'date last 30 days',
    'merchant contains stripe',
    'group by category',
  ],
  density: 'compact',
  remote: true,
}
