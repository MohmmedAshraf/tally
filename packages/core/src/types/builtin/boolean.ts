import type { ColumnType } from '../column-type.ts'
import { BOOLEAN_OPERATORS } from './shared.ts'

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'on', '✓', 'x'])
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'off', '—', '-', ''])

export function parseBoolean(input: unknown): boolean | undefined {
  if (typeof input === 'boolean') return input
  if (typeof input === 'number') return input !== 0
  if (typeof input !== 'string') return undefined
  const text = input.trim().toLowerCase()
  if (TRUE_WORDS.has(text)) return true
  if (FALSE_WORDS.has(text)) return false
  return undefined
}

export const booleanType: ColumnType<boolean> = {
  name: 'bool',
  kind: 'boolean',
  operators: BOOLEAN_OPERATORS,
  aggregates: ['count', 'distinct'],
  facet: 'terms',
  align: 'start',
  card: 'badge',
  searchable: false,
  groupable: true,
  is: (value): value is boolean => typeof value === 'boolean',
  parse: parseBoolean,
  format: (value) => (value ? 'true' : 'false'),
  compare: (a, b) => Number(a) - Number(b),
  detect: (sample) => /^(true|false|yes|no|y|n)$/i.test(sample),
  jsonSchema: () => ({ type: 'boolean' }),
}
