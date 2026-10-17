import { Gauge } from 'lucide-react'
import { createSchema, type Column, type RowData } from 'tally-core'
import { addDays, pick, random, TEAM, TODAY, type Random } from './shared.ts'
import type { Dataset } from './dataset.ts'

const ROWS = 100_000
const WORDS = ['North', 'Blue', 'Iron', 'Quiet', 'Cedar', 'Polar', 'Atlas', 'Copper', 'Lumen']

interface Field {
  readonly column: Column
  readonly value: (next: Random, index: number) => unknown
}

function repeat(count: number, make: (n: number) => Field): readonly Field[] {
  return Array.from({ length: count }, (_, index) => make(index + 1))
}

const fields: readonly Field[] = [
  {
    column: { id: 'name', type: 'text', width: 180, pin: 'left', card: 'title' },
    value: (next, index) => `${pick(next, WORDS)} ${index}`,
  },
  {
    column: { id: 'email', type: 'email', width: 200 },
    value: (_, index) => `u${index}@tally.dev`,
  },
  { column: { id: 'site', type: 'url', width: 180 }, value: (_, index) => `https://s${index}.dev` },
  {
    column: { id: 'sku', type: 'id', width: 110 },
    value: (_, index) => `SKU-${index.toString(36)}`,
  },
  {
    column: { id: 'notes', type: 'text', width: 220 },
    value: (next) => (next() < 0.3 ? '' : pick(next, WORDS)),
  },
  ...repeat(8, (n) => {
    const options = Array.from({ length: 2 + n }, (_, index) => ({
      value: `${'abcdefghij'[index]}${n}`,
    }))
    return {
      column: { id: `enum${n}`, type: 'enum', width: 110, options, aggregate: 'count' },
      value: (next: Random) => pick(next, options).value,
    }
  }),
  ...repeat(3, (n) => ({
    column: { id: `person${n}`, type: 'person', width: 160 },
    value: (next: Random) => pick(next, TEAM),
  })),
  ...repeat(5, (n) => ({
    column: {
      id: `currency${n}`,
      type: 'currency',
      width: 120,
      format: { currency: 'USD' },
      aggregate: 'sum',
    },
    value: (next: Random) => Math.round(next() * 100_000) / 100,
  })),
  ...repeat(5, (n) => ({
    column: { id: `int${n}`, type: 'int', width: 90 },
    value: (next: Random) => Math.floor(next() * 1000),
  })),
  ...repeat(4, (n) => ({
    column: { id: `number${n}`, type: 'number', width: 100 },
    value: (next: Random) => Math.round(next() * 10_000) / 100,
  })),
  ...repeat(4, (n) => ({
    column: {
      id: `percent${n}`,
      type: 'percent',
      width: 140,
      format: { signed: true, fractionDigits: 1 },
      ...(n === 1 ? { sparkline: 'trend' } : {}),
    },
    value: (next: Random) => Math.round((next() * 200 - 50) * 10) / 10,
  })),
  ...repeat(2, (n) => ({
    column: { id: `bar${n}`, type: 'bar', width: 130 },
    value: (next: Random) => Math.round(next() * 100),
  })),
  ...repeat(2, (n) => ({
    column: {
      id: `duration${n}`,
      type: 'duration',
      width: 110,
      format: { durationUnit: 'seconds' },
    },
    value: (next: Random) => Math.floor(next() * 7200),
  })),
  ...repeat(6, (n) => ({
    column: { id: `date${n}`, type: 'date', width: 130, ...(n === 1 ? { relative: true } : {}) },
    value: (next: Random) =>
      next() < 0.05 ? null : addDays(TODAY, Math.floor(next() * 720) - 360),
  })),
  ...repeat(6, (n) => ({
    column: { id: `flag${n}`, type: 'bool', width: 90 },
    value: (next: Random) => next() < 0.5,
  })),
]

function makeRows(): RowData[] {
  const next = random(42)
  return Array.from({ length: ROWS }, (_, index) =>
    Object.fromEntries([
      ['id', index + 1],
      ...fields.map((field) => [field.column.id, field.value(next, index + 1)] as const),
      ['trend', Array.from({ length: 12 }, () => Math.round(next() * 100))],
    ]),
  )
}

let rows: readonly RowData[] | undefined

export const stress: Dataset = {
  id: 'stress',
  title: 'Stress',
  unit: 'rows',
  icon: Gauge,
  schema: createSchema({ columns: fields.map((field) => field.column), key: 'id' }),
  get rows() {
    rows ??= makeRows()
    return rows
  },
  views: [{ name: 'All rows', query: '' }],
  examples: [],
  remote: false,
}
