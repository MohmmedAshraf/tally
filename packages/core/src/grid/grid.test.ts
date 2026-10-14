import { describe, expect, it, vi } from 'vitest'
import { condition } from '../query/ast.ts'
import { createMutation } from '../rows/mutation.ts'
import { createSchema } from '../schema/schema.ts'
import { createArraySource } from '../source/array-source.ts'
import type { DataSource, QueryRequest } from '../source/data-source.ts'
import { createGrid } from './grid.ts'

const schema = createSchema({
  columns: [
    { id: 'name' },
    { id: 'plan', type: 'enum', options: [{ value: 'a' }, { value: 'b' }] },
    { id: 'mrr', type: 'currency', aggregate: 'sum' },
  ],
})

const rows = [
  { id: 1, name: 'One', plan: 'a', mrr: 10 },
  { id: 2, name: 'Two', plan: 'b', mrr: 20 },
  { id: 3, name: 'Three', plan: 'a', mrr: 30 },
]

function remoteSource(overrides: Partial<DataSource> = {}): DataSource & {
  requests: QueryRequest[]
} {
  const requests: QueryRequest[] = []
  return {
    requests,
    capabilities: {
      filter: true,
      sort: false,
      group: false,
      search: false,
      aggregates: false,
      facets: false,
      pagination: 'offset',
      mutate: true,
      live: false,
    },
    query: (request) => {
      requests.push(request)
      const page = request.page !== undefined && 'offset' in request.page ? request.page : undefined
      const slice = page === undefined ? rows : rows.slice(page.offset, page.offset + page.limit)
      return Promise.resolve({ rows: slice, total: rows.length })
    },
    ...overrides,
  }
}

describe('createGrid', () => {
  it('loads through the source and exposes the row model', async () => {
    const grid = createGrid({ schema, source: createArraySource(rows, schema) })
    expect(grid.get().status).toBe('idle')
    await grid.load()
    expect(grid.get()).toMatchObject({ status: 'ready', total: 3, matched: 3 })
    expect(grid.get().aggregates).toEqual({ 'mrr:sum': 60 })
    expect(grid.get().facets?.['plan']).toMatchObject({ kind: 'terms' })
    expect(grid.model().rows.map((item) => item.key)).toEqual([1, 2, 3])
    expect(grid.layout().columns.map((entry) => entry.column.id)).toEqual(['name', 'plan', 'mrr'])
    grid.dispose()
  })

  it('keeps a stable layout per available width until the view changes', () => {
    const grid = createGrid({ schema, source: createArraySource(rows, schema) })
    const fitted = grid.layout(900)
    const natural = grid.layout()
    expect(grid.layout(900)).toBe(fitted)
    expect(grid.layout()).toBe(natural)
    grid.view.setSort([{ column: 'name', direction: 'asc' }])
    expect(grid.layout(900)).not.toBe(fitted)
  })

  it('reloads when the query part of the view changes and ignores stale responses', async () => {
    const grid = createGrid({ schema, source: createArraySource(rows, schema) })
    await grid.load()
    const states: string[] = []
    const stop = grid.subscribe((state) => states.push(state.status))
    grid.view.setFilter(condition('plan', 'eq', 'a'))
    grid.view.toggleSort('mrr')
    await vi.waitFor(() => expect(grid.get().status).toBe('ready'))
    expect(grid.model().rows.map((item) => item.key)).toEqual([3, 1])
    expect(grid.get().matched).toBe(2)
    expect(states.at(-1)).toBe('ready')
    stop()
    grid.view.setDensity('compact')
    expect(grid.get().status).toBe('ready')
    grid.dispose()
  })

  it('runs unsupported parts on the client and pages through offsets', async () => {
    const source = remoteSource()
    const grid = createGrid({ schema, source, pageSize: 2 })
    grid.view.toggleSort('mrr')
    await grid.load()
    expect(source.requests[0]).toEqual({ version: 1, sort: [], page: { offset: 0, limit: 2 } })
    expect(grid.model().rows.map((item) => item.key)).toEqual([2, 1])
    expect(grid.get().aggregates).toEqual({ 'mrr:sum': 30 })
    grid.setPage(1)
    await vi.waitFor(() => expect(grid.get().status).toBe('ready'))
    expect(grid.model().rows.map((item) => item.key)).toEqual([3])
    grid.view.setGroup('plan')
    await vi.waitFor(() => expect(source.requests).toHaveLength(3))
    await vi.waitFor(() => expect(grid.get().status).toBe('ready'))
    expect(grid.get().page.index).toBe(0)
    expect(grid.model().groups.map((group) => group.key)).toEqual(['a', 'b'])
    grid.dispose()
  })

  it('appends pages for cursor sources', async () => {
    const source = remoteSource({
      capabilities: { ...remoteSource().capabilities, pagination: 'cursor' },
      query: (request) => {
        const cursor =
          request.page !== undefined && 'cursor' in request.page ? request.page.cursor : undefined
        const start = cursor === undefined ? 0 : Number(cursor)
        const slice = rows.slice(start, start + 2)
        const next = start + 2
        return Promise.resolve({
          rows: slice,
          ...(next < rows.length ? { cursor: String(next) } : {}),
        })
      },
    })
    const grid = createGrid({ schema, source, pageSize: 2 })
    await grid.load()
    expect(grid.get()).toMatchObject({ cursor: '2', exhausted: false })
    await grid.loadMore()
    expect(grid.model().rows.map((item) => item.key)).toEqual([1, 2, 3])
    expect(grid.get().exhausted).toBe(true)
    await grid.loadMore()
    expect(grid.model().rows).toHaveLength(3)
    grid.dispose()
  })

  it('commits optimistically, forwards to the source and rolls back rejections', async () => {
    const mutate = vi
      .fn<NonNullable<DataSource['mutate']>>()
      .mockResolvedValueOnce({ accepted: true })
      .mockResolvedValueOnce({ accepted: false, errors: [{ message: 'nope' }] })
      .mockRejectedValueOnce(new Error('offline'))
    const grid = createGrid({ schema, source: remoteSource({ mutate }) })
    await grid.load()
    const ok = await grid.setCells([{ key: 1, column: 'mrr', value: '15' }])
    expect(ok.accepted).toBe(true)
    expect(grid.rows.byKey(1)?.['mrr']).toBe(15)
    expect(mutate.mock.calls[0]?.[0]?.[0]).toMatchObject({
      label: 'Edit mrr',
      changes: [{ key: 1, column: 'mrr', from: 10, to: 15 }],
    })
    const rejected = await grid.setCells([{ key: 2, column: 'mrr', value: 99 }])
    expect(rejected.accepted).toBe(false)
    expect(grid.rows.byKey(2)?.['mrr']).toBe(20)
    const thrown = await grid.deleteRows([3])
    expect(thrown).toEqual({ accepted: false, errors: [{ message: 'offline' }] })
    expect(grid.rows.rows()).toHaveLength(3)
    expect(grid.rows.history()).toHaveLength(1)
    const noop = await grid.setCells([{ key: 1, column: 'mrr', value: 15 }])
    expect(noop.accepted).toBe(true)
    expect(mutate).toHaveBeenCalledTimes(3)
    await grid.setCells(
      [
        { key: 1, column: 'mrr', value: 1 },
        { key: 2, column: 'mrr', value: 2 },
      ],
      'Paste',
    )
    expect(grid.rows.history().at(-1)?.label).toBe('Paste 2 cells')
    grid.dispose()
  })

  it('undoes and redoes against the source and inserts rows', async () => {
    const source = createArraySource(rows, schema)
    const grid = createGrid({ schema, source })
    await grid.load()
    await grid.insertRows([{ id: 4, name: 'Four', plan: 'b', mrr: 40 }])
    expect(grid.rows.rows()).toHaveLength(4)
    expect(source.rows()).toHaveLength(4)
    const undone = await grid.undo()
    expect(undone?.label).toBe('Add row')
    expect(source.rows()).toHaveLength(3)
    expect(grid.rows.rows()).toHaveLength(3)
    await grid.redo()
    expect(source.rows()).toHaveLength(4)
    expect(await grid.redo()).toBeUndefined()
    await grid.commit(createMutation({ label: 'Empty' }))
    expect(grid.rows.history()).toHaveLength(1)
    grid.dispose()
  })

  it('applies live patches, resolves the changed flag and tracks selection', async () => {
    const source = createArraySource(rows, schema)
    const grid = createGrid({ schema, source })
    source.patch({ upserts: [{ id: 2, name: 'Two', plan: 'b', mrr: 21 }] })
    expect(grid.rows.rows()).toHaveLength(0)
    await grid.load()
    source.patch({ upserts: [{ id: 2, name: 'Two', plan: 'b', mrr: 25 }] })
    expect(grid.rows.byKey(2)?.['mrr']).toBe(25)
    expect(grid.rows.get().changed.get(2)?.has('mrr')).toBe(true)
    grid.view.setFilter({ type: 'flag', name: 'changed' })
    await vi.waitFor(() => expect(grid.get().status).toBe('ready'))
    expect(grid.model().rows.map((item) => item.key)).toEqual([2])
    grid.view.setFilter(undefined)
    await vi.waitFor(() => expect(grid.model().rows).toHaveLength(3))
    grid.selection.dispatch({ type: 'focus', cell: { row: 1, column: 1 } })
    grid.selection.dispatch({ type: 'move', rows: 5, columns: 5 })
    expect(grid.selection.get().active).toEqual({ row: 2, column: 2 })
    grid.selection.dispatch({ type: 'selectRow', index: 0, mode: 'toggle' })
    expect([...grid.selection.get().rows]).toEqual([1])
    grid.dispose()
  })

  it('re-ranks live rows by the view sort', async () => {
    const source = createArraySource(rows, schema)
    const grid = createGrid({ schema, source })
    grid.view.setSort([{ column: 'mrr', direction: 'desc' }])
    await grid.load()
    expect(grid.model().rows.map((item) => item.key)).toEqual([3, 2, 1])
    source.patch({ upserts: [{ id: 1, name: 'One', plan: 'a', mrr: 50 }] })
    expect(grid.model().rows.map((item) => item.key)).toEqual([1, 3, 2])
    grid.view.setGroup('plan')
    await vi.waitFor(() => expect(grid.get().groups).toHaveLength(2))
    const before = grid.rows.rows().map((row) => row['id'])
    source.patch({ upserts: [{ id: 2, name: 'Two', plan: 'b', mrr: 99 }] })
    expect(grid.rows.rows().map((row) => row['id'])).toEqual(before)
    grid.dispose()
  })

  it('can be disposed and loaded again', async () => {
    const source = createArraySource(rows, schema)
    const grid = createGrid({ schema, source })
    await grid.load()
    grid.dispose()
    await grid.load()
    grid.view.setFilter(condition('plan', 'eq', 'b'))
    await vi.waitFor(() => expect(grid.model().rows.map((item) => item.key)).toEqual([2]))
    source.patch({ upserts: [{ id: 2, name: 'Two', plan: 'b', mrr: 21 }] })
    expect(grid.rows.byKey(2)?.['mrr']).toBe(21)
    grid.dispose()
  })

  it('creates blank rows keyed by the schema or a custom factory', () => {
    const grid = createGrid({ schema, source: createArraySource(rows, schema) })
    const blank = grid.newRow()
    expect(typeof blank['id']).toBe('string')
    const custom = createGrid({
      schema,
      source: createArraySource(rows, schema),
      newRow: () => ({ id: 99, name: 'New' }),
    })
    expect(custom.newRow()).toEqual({ id: 99, name: 'New' })
    const keyed = createSchema({ columns: [{ id: 'name' }], key: (row) => String(row['name']) })
    const unkeyed = createGrid({ schema: keyed, source: createArraySource([], keyed) })
    expect(() => unkeyed.newRow()).toThrow('Provide newRow')
    expect(keyed.keyField).toBeUndefined()
    expect(schema.keyField).toBe('id')
  })

  it('reports source failures', async () => {
    const grid = createGrid({
      schema,
      source: remoteSource({ query: () => Promise.reject(new Error('boom')) }),
    })
    await grid.load()
    expect(grid.get().status).toBe('error')
    expect(grid.get().error).toBeInstanceOf(Error)
    expect(grid.get().error).toMatchObject({ message: 'boom' })
    grid.dispose()
  })
})
