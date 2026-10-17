import type { ColumnInput } from '../schema/column.ts'
import type { RowData } from '../rows/row.ts'
import { createSchema, type Schema } from '../schema/schema.ts'

const STRESS_ROWS = 100_000

export type Random = () => number

export function seeded(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WORDS = ['North', 'Blue', 'Iron', 'Quiet', 'Cedar', 'Polar', 'Atlas', 'Copper', 'Lumen']
const PEOPLE = ['Amara Owusu', 'Mateo Ruiz', 'Kenji Sato', 'Lena Huber', 'Omar Farouk', 'Mei Lin']

interface Field {
  readonly column: ColumnInput
  readonly value: (next: Random, index: number) => unknown
}

function values(prefix: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`)
}

function pick(next: Random, list: readonly string[]): string {
  return list[Math.floor(next() * list.length)] ?? ''
}

function day(next: Random): string {
  const month = 1 + Math.floor(next() * 12)
  const date = 1 + Math.floor(next() * 28)
  return `2026-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
}

function repeat(count: number, make: (index: number) => Field): readonly Field[] {
  return Array.from({ length: count }, (_, index) => make(index + 1))
}

const fields: readonly Field[] = [
  { column: { id: 'name', type: 'text' }, value: (next, index) => `${pick(next, WORDS)} ${index}` },
  { column: { id: 'email', type: 'email' }, value: (_next, index) => `user${index}@example.com` },
  { column: { id: 'site', type: 'url' }, value: (_next, index) => `https://site${index}.dev` },
  { column: { id: 'sku', type: 'id' }, value: (_next, index) => `SKU-${index.toString(36)}` },
  {
    column: { id: 'notes', type: 'text' },
    value: (next) => (next() < 0.3 ? '' : pick(next, WORDS)),
  },
  ...repeat(8, (n) => {
    const choices = values(`e${n}-`, 3 + n)
    return {
      column: { id: `enum${n}`, type: 'enum', options: choices.map((value) => ({ value })) },
      value: (next: Random) => pick(next, choices),
    }
  }),
  ...repeat(3, (n) => ({
    column: { id: `person${n}`, type: 'person' },
    value: (next: Random) => pick(next, PEOPLE),
  })),
  ...repeat(5, (n) => ({
    column: { id: `currency${n}`, type: 'currency', format: { currency: 'USD' } },
    value: (next: Random) => Math.round(next() * 100_000) / 100,
  })),
  ...repeat(5, (n) => ({
    column: { id: `int${n}`, type: 'int' },
    value: (next: Random) => Math.floor(next() * 1000),
  })),
  ...repeat(4, (n) => ({
    column: { id: `number${n}`, type: 'number' },
    value: (next: Random) => next() * 100,
  })),
  ...repeat(4, (n) => ({
    column:
      n === 1
        ? { id: 'percent1', type: 'percent', sparkline: 'trend' }
        : { id: `percent${n}`, type: 'percent' },
    value: (next: Random) => Math.round((next() * 200 - 50) * 10) / 10,
  })),
  ...repeat(2, (n) => ({
    column: { id: `bar${n}`, type: 'bar' },
    value: (next: Random) => Math.round(next() * 100),
  })),
  ...repeat(2, (n) => ({
    column: { id: `duration${n}`, type: 'duration', format: { durationUnit: 'seconds' } },
    value: (next: Random) => Math.floor(next() * 7200),
  })),
  ...repeat(6, (n) => ({
    column: { id: `date${n}`, type: 'date' },
    value: (next: Random) => (next() < 0.05 ? null : day(next)),
  })),
  ...repeat(6, (n) => ({
    column: { id: `flag${n}`, type: 'bool' },
    value: (next: Random) => next() < 0.5,
  })),
]

export function createStressSchema(): Schema {
  return createSchema({ columns: fields.map((field) => field.column), key: 'id' })
}

export function stressRow(next: Random, index: number): RowData {
  return Object.fromEntries([
    ['id', index],
    ...fields.map((field) => [field.column.id, field.value(next, index)] as const),
    ['trend', Array.from({ length: 12 }, () => Math.round(next() * 100))],
  ])
}

export function createStressRows(
  count: number = STRESS_ROWS,
  seed: number = 42,
): readonly RowData[] {
  const next = seeded(seed)
  return Array.from({ length: count }, (_, index) => stressRow(next, index))
}
