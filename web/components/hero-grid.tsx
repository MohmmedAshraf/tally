'use client'

import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  createArraySource,
  createSchema,
  defaultView,
  isEmptyValue,
  type RowData,
} from 'tally-core'
import { defaultRenderers, Tally, useGrid, type CellRenderer } from 'tally-react'
import { accounts, photo, type Account } from '@/lib/accounts'
import { useTicks } from '@/lib/use-ticks'

const renewals: Readonly<Record<string, string>> = {
  'Oct 13': '2026-10-13',
  'Nov 17': '2026-11-17',
  'Oct 15': '2026-10-15',
  'Feb 1': '2027-02-01',
  'Jun 26': '2027-06-26',
  'Dec 18': '2026-12-18',
  'Jan 16': '2027-01-16',
  'Sep 20': '2027-09-20',
  'Aug 9': '2027-08-09',
  'Feb 12': '2027-02-12',
}

const schema = createSchema({
  key: 'id',
  columns: [
    {
      id: 'account',
      label: 'Account',
      width: 182,
      pin: 'left',
      avatar: true,
      subtitle: 'domain',
    },
    { id: 'domain', label: 'Domain', hidden: true },
    { id: 'owner', label: 'Owner', type: 'person', width: 160 },
    {
      id: 'plan',
      label: 'Plan',
      type: 'enum',
      width: 112,
      options: [
        { value: 'enterprise', label: 'Enterprise' },
        { value: 'team', label: 'Team' },
      ],
    },
    {
      id: 'status',
      label: 'Status',
      type: 'enum',
      width: 112,
      options: [
        { value: 'active', label: 'Active', color: 'oklch(0.55 0.13 155)' },
        { value: 'trial', label: 'Trial', color: 'oklch(0.53 0.2 268)' },
        { value: 'past_due', label: 'Past due', color: 'oklch(0.76 0.15 75)' },
        { value: 'churned', label: 'Churned', color: 'oklch(0.7 0.01 265)' },
      ],
    },
    {
      id: 'mrr',
      label: 'MRR',
      type: 'currency',
      width: 112,
      format: { currency: 'USD', fractionDigits: 0 },
      aggregate: 'sum',
    },
    {
      id: 'growth',
      label: 'Growth',
      type: 'percent',
      width: 132,
      format: { signed: true, fractionDigits: 1 },
      aggregate: 'avg',
      sparkline: 'history',
    },
    { id: 'health', label: 'Health', type: 'bar', width: 92, aggregate: 'avg' },
    { id: 'renewal', label: 'Renewal', type: 'date', width: 128, flex: 1 },
  ],
})

function history(item: Account, seed: number): number[] {
  const start = 1 / (1 + Math.max(-0.9, item.growth / 100))
  return Array.from({ length: 9 }, (_, index) => {
    const t = index / 8
    const noise = index < 8 ? Math.sin((seed + 1) * 91.7 + index * 17.3) * 0.04 : 0
    return Math.round((start + (1 - start) * t) * (1 + noise) * item.mrr)
  })
}

const rows: readonly RowData[] = accounts.slice(0, 10).map((item, index) => ({
  id: index + 1,
  account: item.name,
  domain: `${item.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
  owner: item.owner,
  plan: item.plan.toLowerCase(),
  status: item.status.toLowerCase().replace(' ', '_'),
  mrr: item.mrr,
  growth: item.growth,
  history: history(item, index),
  health: item.health,
  renewal: renewals[item.renews] ?? null,
}))

const photos = new Map(accounts.map((item) => [item.owner, photo(item.person)]))

const PhotoPerson: CellRenderer = (props) => {
  const src = isEmptyValue(props.value) ? undefined : photos.get(props.text)
  if (src === undefined) return defaultRenderers['person']?.(props)
  return (
    <>
      <img src={src} alt="" width={24} height={24} className="tally-avatar object-cover" />
      <span className="tally-text">{props.text}</span>
    </>
  )
}

const renderers = { person: PhotoPerson }

const tour = [
  { row: 0, column: 4, rows: 1 },
  { row: 1, column: 4, rows: 1 },
  { row: 2, column: 4, rows: 1 },
  { row: 2, column: 5, rows: 1 },
  { row: 4, column: 5, rows: 1 },
  { row: 4, column: 4, rows: 3 },
  { row: 6, column: 1, rows: 1 },
  { row: 6, column: 0, rows: 1 },
  { row: 3, column: 0, rows: 1 },
  { row: 3, column: 3, rows: 1 },
  { row: 3, column: 4, rows: 1 },
] as const

const STEP_TICKS = 13

export function HeroGrid(): ReactNode {
  const frame = useRef<HTMLDivElement>(null)
  const [source] = useState(() => createArraySource(rows, schema))
  const [view] = useState(() => ({
    ...defaultView(schema),
    sort: [{ column: 'mrr', direction: 'desc' as const }],
  }))
  const grid = useGrid({ schema, source, view })
  const reduce = useReducedMotion() === true
  const [touched, setTouched] = useState(false)
  const tick = useTicks(frame, { length: tour.length * STEP_TICKS, settled: 0 })
  const step = Math.floor(tick / STEP_TICKS)

  useEffect(() => {
    if (reduce || touched) return
    const stop = tour[step]
    if (stop === undefined) return
    const { row, column, rows: height } = stop
    grid.selection.dispatch({ type: 'focus', cell: { row, column } })
    if (height > 1) {
      grid.selection.dispatch({
        type: 'focus',
        cell: { row: row + height - 1, column },
        extend: true,
      })
    }
  }, [grid, reduce, step, touched])

  useEffect(() => {
    const element = frame.current
    if (element === null) return
    const stop = (): void => setTouched(true)
    element.addEventListener('pointerdown', stop)
    element.addEventListener('keydown', stop)
    return () => {
      element.removeEventListener('pointerdown', stop)
      element.removeEventListener('keydown', stop)
    }
  }, [])

  return (
    <div ref={frame} className="h-full">
      <Tally
        grid={grid}
        label="Accounts"
        theme="light"
        layout="grid"
        renderers={renderers}
        initialSize={{ width: 1082, height: 656 }}
        className="h-full"
      />
    </div>
  )
}
