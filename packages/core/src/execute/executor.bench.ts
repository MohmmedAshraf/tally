import { expect, test } from 'vitest'
import { parseQuery } from '../query/parse.ts'
import { createSchema } from '../schema/schema.ts'
import { execute } from './executor.ts'

const schema = createSchema({
  columns: [
    { id: 'account' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', type: 'currency' },
    { id: 'seats', type: 'int' },
    { id: 'renewal', type: 'date' },
  ],
})

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = seeded(7)
const plans = ['free', 'pro', 'team']
const rows = Array.from({ length: 100_000 }, (_, index) => ({
  id: index,
  account: `Account ${index}`,
  plan: plans[Math.floor(random() * 3)],
  mrr: Math.round(random() * 10_000),
  seats: Math.round(random() * 100),
  renewal: `2026-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-15`,
}))

const query = parseQuery('plan is pro or team and mrr > 2k sort by mrr desc', schema).query
const search = parseQuery('account 4242', schema).query
const budgetMs = 250

test('100k rows stay under the latency budget', async ({ bench }) => {
  const result = await bench.compare(
    bench('filter and sort', () => {
      execute(rows, query, schema, { today: '2026-10-13' })
    }),
    bench('group with aggregates', () => {
      execute(
        rows,
        { ...query, group: { column: 'plan' }, aggregates: [{ column: 'mrr', fn: 'sum' }] },
        schema,
      )
    }),
    bench('facets', () => {
      execute(rows, { facets: ['mrr', 'plan', 'renewal'] }, schema)
    }),
    bench('search', () => {
      execute(rows, search, schema)
    }),
  )
  for (const name of ['filter and sort', 'group with aggregates', 'facets', 'search'] as const) {
    expect(result.get(name).latency.mean).toBeLessThan(budgetMs)
  }
})
