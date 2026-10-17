import { describe, expect, it } from 'vitest'
import type { Filter } from '../query/ast.ts'
import { createMutation } from '../rows/mutation.ts'
import { createSchema } from '../schema/schema.ts'
import { createArraySource } from './array-source.ts'

const schema = createSchema({
  columns: [
    { id: 'name' },
    { id: 'plan', type: 'enum', options: [{ value: 'a' }, { value: 'b' }] },
    { id: 'mrr', type: 'currency' },
  ],
})
const rows = [
  { id: 1, name: 'One', plan: 'a', mrr: 10 },
  { id: 2, name: 'Two', plan: 'b', mrr: 20 },
  { id: 3, name: 'Three', plan: 'a', mrr: 30 },
]

describe('createArraySource', () => {
  it('answers protocol queries from the executor', async () => {
    const source = createArraySource(rows, schema)
    const response = await source.query({
      version: 1,
      filter: { type: 'condition', column: 'plan', op: 'eq', value: 'a' },
      sort: [{ column: 'mrr', direction: 'desc' }],
      group: { column: 'plan' },
      aggregates: [{ column: 'mrr', fn: 'sum' }],
      facets: ['plan'],
      page: { offset: 0, limit: 1 },
    })
    expect(response.rows.map((row) => row['id'])).toEqual([3, 1])
    expect(response.total).toBe(3)
    expect(response.matched).toBe(2)
    expect(response.groups).toEqual([
      { key: 'a', value: 'a', count: 2, aggregates: { 'mrr:sum': 40 } },
    ])
    expect(response.aggregates).toEqual({ 'mrr:sum': 40 })
    expect(response.facets?.['plan']).toMatchObject({ kind: 'terms' })
    expect(await source.schema?.()).toBe(schema.columns)
    const cursor = await source.query({ version: 1, sort: [], page: { cursor: 'x', limit: 1 } })
    expect(cursor.rows).toHaveLength(3)
  })

  it('serves offset and cursor pages when pagination is enabled', async () => {
    const offset = createArraySource(rows, schema, { pagination: 'offset' })
    expect(offset.capabilities.pagination).toBe('offset')
    const page = await offset.query({ version: 1, sort: [], page: { offset: 1, limit: 1 } })
    expect(page.rows.map((row) => row['id'])).toEqual([2])
    expect(page.cursor).toBeUndefined()
    const cursor = createArraySource(rows, schema, { pagination: 'cursor' })
    const first = await cursor.query({ version: 1, sort: [], page: { limit: 2 } })
    expect(first.rows.map((row) => row['id'])).toEqual([1, 2])
    expect(first.cursor).toBe('2')
    const last = await cursor.query({
      version: 1,
      sort: [],
      page: { cursor: first.cursor, limit: 2 },
    })
    expect(last.rows.map((row) => row['id'])).toEqual([3])
    expect(last.cursor).toBeUndefined()
    const bad = await cursor.query({ version: 1, sort: [], page: { cursor: 'x', limit: 2 } })
    expect(bad.rows.map((row) => row['id'])).toEqual([1, 2])
  })

  it('applies mutations and returns the touched rows', async () => {
    const source = createArraySource(rows, schema)
    const result = await source.mutate?.([
      createMutation({ label: 'Edit', changes: [{ key: 2, column: 'mrr', from: 20, to: 25 }] }),
    ])
    expect(result).toEqual({ accepted: true, rows: [{ id: 2, name: 'Two', plan: 'b', mrr: 25 }] })
    expect(source.rows()[1]?.['mrr']).toBe(25)
    const readOnly = createArraySource(rows, schema, { mutable: false })
    expect(readOnly.capabilities.mutate).toBe(false)
    expect((await readOnly.mutate?.([]))?.accepted).toBe(false)
  })

  it('publishes live patches to subscribers', () => {
    const source = createArraySource(rows, schema)
    const seen: unknown[] = []
    const stop = source.subscribe?.((patch) => seen.push(patch))
    source.patch({
      upserts: [
        { id: 4, name: 'Four', plan: 'b', mrr: 40 },
        { id: 1, name: 'Uno', plan: 'a', mrr: 10 },
      ],
      deletes: [2],
    })
    expect(source.rows().map((row) => [row['id'], row['name']])).toEqual([
      [1, 'Uno'],
      [3, 'Three'],
      [4, 'Four'],
    ])
    expect(seen).toHaveLength(1)
    stop?.()
    source.patch({ deletes: [3] })
    expect(seen).toHaveLength(1)
    source.replace([])
    expect(source.rows()).toEqual([])
  })

  it('reuses facets and aggregates while only the sort changes and recomputes after a patch', async () => {
    const source = createArraySource(rows, schema)
    const filter: Filter = { type: 'condition', column: 'mrr', op: 'gt', value: 5 }
    const ask = (sort: 'asc' | 'desc', where = filter) =>
      source.query({
        version: 1,
        filter: where,
        sort: [{ column: 'mrr', direction: sort }],
        facets: ['plan'],
        aggregates: [{ column: 'mrr', fn: 'sum' }],
      })
    const first = await ask('asc')
    await source.query({ version: 1, filter, sort: [], page: { offset: 0, limit: 1 } })
    const resorted = await ask('desc')
    expect(resorted.facets).toBe(first.facets)
    expect(resorted.aggregates).toBe(first.aggregates)
    expect(resorted.aggregates).toEqual({ 'mrr:sum': 60 })
    expect(resorted.rows.map((row) => row['id'])).toEqual([3, 2, 1])
    source.patch({ upserts: [{ id: 4, name: 'Four', plan: 'b', mrr: 40 }] })
    const patched = await ask('desc')
    expect(patched.facets).not.toBe(first.facets)
    expect(patched.facets?.['plan']).toEqual({
      kind: 'terms',
      terms: [
        { value: 'a', count: 2 },
        { value: 'b', count: 2 },
      ],
      distinct: 2,
    })
    const narrowed = await ask('desc', { type: 'condition', column: 'mrr', op: 'gt', value: 25 })
    expect(narrowed.facets?.['plan']).toMatchObject({
      distinct: 2,
      terms: [
        { value: 'a', count: 1 },
        { value: 'b', count: 1 },
      ],
    })
    expect((await ask('asc')).facets).toBe(patched.facets)
  })
})
