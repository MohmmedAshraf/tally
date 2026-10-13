import { QueryClient } from '@tanstack/query-core'
import { createArraySource, createMutation, type RowPatch } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { describe, expect, it, vi } from 'vitest'
import { createQuerySource } from './source.ts'

function setup() {
  const inner = createArraySource(conformanceRows, conformanceSchema, { today: CONFORMANCE_TODAY })
  const query = vi.spyOn(inner, 'query')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const source = createQuerySource({ client, source: inner, queryKey: ['accounts'] })
  return { inner, query, client, source }
}

describe('createQuerySource', () => {
  it('passes conformance through the query cache', async () => {
    const { source } = setup()
    const report = await runConformance((request) => source.query(request), {
      capabilities: source.capabilities,
    })
    expect(report.failures).toEqual([])
  })

  it('dedupes identical requests and serves fresh data from the cache', async () => {
    const { client, query, source } = setup()
    const fresh = createQuerySource({
      client,
      source: setup().inner,
      queryKey: ['fresh'],
      staleTime: 60_000,
    })
    const request = { version: 1 as const, sort: [{ column: 'id', direction: 'asc' as const }] }
    const [a, b] = await Promise.all([source.query(request), source.query(request)])
    expect(a).toBe(b)
    expect(query).toHaveBeenCalledTimes(1)
    await fresh.query(request)
    await fresh.query(request)
    expect(client.getQueryCache().findAll({ queryKey: ['fresh', 'query'] })).toHaveLength(1)
    expect(client.getQueryState(['fresh', 'query', request])?.dataUpdateCount).toBe(1)
  })

  it('caches the schema and invalidates queries after a mutation', async () => {
    const { client, inner, source } = setup()
    const schema = vi.spyOn(inner, 'schema')
    expect(await source.schema!()).toEqual(conformanceSchema.columns)
    await source.schema!()
    expect(schema).toHaveBeenCalledTimes(1)
    const request = { version: 1 as const, sort: [] }
    await source.query(request)
    const result = await source.mutate!([
      createMutation({
        label: 'edit',
        changes: [{ key: 'acc_001', column: 'account', from: 'Acme', to: 'Renamed' }],
      }),
    ])
    expect(result.accepted).toBe(true)
    expect(client.getQueryState(['accounts', 'query', request])?.isInvalidated).toBe(true)
  })

  it('relays live patches and invalidates', async () => {
    const { client, inner, source } = setup()
    const patches: RowPatch[] = []
    const stop = source.subscribe!((patch) => patches.push(patch))
    const request = { version: 1 as const, sort: [] }
    await source.query(request)
    inner.patch({ deletes: ['acc_003'] })
    expect(patches).toEqual([{ deletes: ['acc_003'] }])
    await vi.waitFor(() => {
      expect(client.getQueryState(['accounts', 'query', request])?.isInvalidated).toBe(true)
    })
    stop()
  })
})
