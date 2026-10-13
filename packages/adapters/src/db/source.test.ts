import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'
import { createMutation, type RowData, type RowPatch } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { describe, expect, it, vi } from 'vitest'
import { createCollectionSource } from './source.ts'

function setup(initialData: readonly RowData[] = conformanceRows) {
  const collection = createCollection(
    localOnlyCollectionOptions({
      getKey: (row: RowData) => String(row['id']),
      initialData: [...initialData],
    }),
  )
  const source = createCollectionSource(collection, conformanceSchema, { today: CONFORMANCE_TODAY })
  return { collection, source }
}

describe('createCollectionSource', () => {
  it('passes conformance over a local collection', async () => {
    const { source } = setup()
    const report = await runConformance((request) => source.query(request), {
      capabilities: source.capabilities,
    })
    expect(report.failures).toEqual([])
  })

  it('writes through the collection and reads canonical rows back', async () => {
    const { collection, source } = setup()
    const result = await source.mutate!([
      createMutation({
        label: 'edit',
        changes: [{ key: 'acc_001', column: 'account', from: 'Acme', to: 'Renamed' }],
        inserted: [{ row: { id: 'acc_new', account: 'New', plan: 'pro' } }],
        deleted: [{ row: conformanceRows[1]!, index: 1 }],
      }),
    ])
    expect(result.accepted).toBe(true)
    expect(result.rows?.map((row) => [row['id'], row['account']])).toEqual([
      ['acc_001', 'Renamed'],
      ['acc_new', 'New'],
    ])
    expect(collection.get('acc_002')).toBeUndefined()
    expect(collection.get('acc_001')?.['account']).toBe('Renamed')
    const response = await source.query({
      version: 1,
      sort: [],
      filter: {
        type: 'condition',
        column: 'id',
        op: 'in',
        value: ['acc_001', 'acc_002', 'acc_new'],
      },
    })
    expect(response.rows.map((row) => row['id'])).toEqual(['acc_001', 'acc_new'])
    expect(response.rows[0]).not.toHaveProperty('$hasPendingWrites')
  })

  it('publishes collection changes as patches while subscribed', async () => {
    const { collection, source } = setup()
    const patches: RowPatch[] = []
    const stop = source.subscribe!((patch) => patches.push(patch))
    collection.update('acc_003', (draft) => {
      draft['account'] = 'Live'
    })
    collection.delete('acc_004')
    await vi.waitFor(() => {
      expect(patches.flatMap((patch) => patch.deletes ?? [])).toEqual(['acc_004'])
    })
    expect(patches.flatMap((patch) => patch.upserts ?? []).map((row) => row['account'])).toEqual([
      'Live',
    ])
    expect(source.rows().find((row) => row['id'] === 'acc_003')?.['account']).toBe('Live')
    stop()
    collection.delete('acc_005')
    expect(patches.flatMap((patch) => patch.deletes ?? [])).toEqual(['acc_004'])
    expect(source.rows().some((row) => row['id'] === 'acc_005')).toBe(false)
  })

  it('reports a read only source', async () => {
    const { collection } = setup()
    const source = createCollectionSource(collection, conformanceSchema, { mutable: false })
    expect(source.capabilities.mutate).toBe(false)
    await expect(source.mutate!([createMutation({ label: 'x' })])).resolves.toEqual({
      accepted: false,
      errors: [{ message: 'Source is read only' }],
    })
  })
})
