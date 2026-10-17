import { createDefaultRegistry, createSchema, type ColumnType } from 'tally-core'

const STAR = '★'

const rating: ColumnType<number> = {
  name: 'rating',
  kind: 'number',
  operators: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'in', 'notIn', 'empty', 'notEmpty'],
  aggregates: ['avg', 'min', 'max', 'count'],
  facet: 'histogram',
  align: 'start',
  card: 'badge',
  searchable: false,
  groupable: true,
  is: (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5,
  parse: (input) => {
    const text = String(input).trim()
    const stars = /^★+$/.test(text) ? text.length : Number(text)
    return Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : undefined
  },
  format: (value) => STAR.repeat(value),
  compare: (a, b) => a - b,
  detect: (sample) => /^★{1,5}$/.test(sample),
  jsonSchema: () => ({ type: 'integer', minimum: 1, maximum: 5 }),
}

export const registry = createDefaultRegistry().register(rating)

export const schema = createSchema({
  key: 'id',
  registry,
  columns: [
    { id: 'product', label: 'Product' },
    { id: 'score', label: 'Score', type: 'rating', aggregate: 'avg' },
  ],
})
