import { createClient } from '@supabase/supabase-js'
import { createMutation, type Filter, type RowPatch } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceCases,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createCompiler } from './compile.ts'
import { createSupabaseSource } from './source.ts'

const compiler = createCompiler({ schema: conformanceSchema, today: CONFORMANCE_TODAY, key: 'id' })

function where(filter: Filter): string {
  return compiler.filter(filter)
}

describe('postgrest compiler', () => {
  it('compiles conditions with empty aware semantics', () => {
    expect(where({ type: 'condition', column: 'account', op: 'eq', value: 'Acme' })).toBe(
      'account.ilike."acme"',
    )
    expect(where({ type: 'condition', column: 'account', op: 'neq', value: 'Acme' })).toBe(
      'or(account.is.null,account.eq."",account.not.ilike."acme")',
    )
    expect(where({ type: 'condition', column: 'account', op: 'contains', value: '50%_' })).toBe(
      'account.ilike."%50\\\\%\\\\_%"',
    )
    expect(where({ type: 'condition', column: 'mrr', op: 'between', value: [10, 20] })).toBe(
      'and(mrr.gte.10,mrr.lte.20)',
    )
    expect(where({ type: 'condition', column: 'active', op: 'eq', value: true })).toBe(
      'active.is.true',
    )
    expect(where({ type: 'condition', column: 'plan', op: 'in', value: ['free', 'pro'] })).toBe(
      'plan.in.("free","pro")',
    )
    expect(where({ type: 'condition', column: 'owner', op: 'in', value: ['Mona', 'Ali'] })).toBe(
      'or(owner.ilike."mona",owner.ilike."ali")',
    )
    expect(where({ type: 'condition', column: 'seats', op: 'empty', value: undefined })).toBe(
      'seats.is.null',
    )
    expect(
      where({
        type: 'condition',
        column: 'renewal',
        op: 'within',
        value: { direction: 'last', unit: 'day', amount: 7 },
      }),
    ).toBe('and(renewal.gte."2026-03-08",renewal.lte."2026-03-15")')
  })

  it('pushes negation down so empties behave like the reference engine', () => {
    expect(
      where({
        type: 'not',
        filter: {
          type: 'and',
          filters: [
            { type: 'condition', column: 'mrr', op: 'gt', value: 5 },
            { type: 'condition', column: 'plan', op: 'eq', value: 'pro' },
          ],
        },
      }),
    ).toBe('or(mrr.is.null,mrr.not.gt.5,plan.is.null,plan.eq."",plan.neq."pro")')
    expect(where({ type: 'not', filter: { type: 'search', text: 'x' } })).toContain(
      'or(account.is.null,account.eq."",account.not.ilike."%x%")',
    )
    expect(
      where({
        type: 'not',
        filter: { type: 'condition', column: 'seats', op: 'notEmpty', value: 1 },
      }),
    ).toBe('seats.is.null')
  })

  it('quotes reserved characters', () => {
    expect(where({ type: 'condition', column: 'plan', op: 'eq', value: 'a,b("c")' })).toBe(
      'plan.eq."a,b(\\"c\\")"',
    )
  })
})

const url = process.env['TALLY_SUPABASE_URL']
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const key = process.env['TALLY_SUPABASE_KEY'] ?? LOCAL_ANON_KEY

async function settle(patches: RowPatch[]): Promise<void> {
  const seen = patches.length
  await new Promise((resolve) => setTimeout(resolve, 1500))
  if (patches.length !== seen) return settle(patches)
  patches.length = 0
}

describe.skipIf(url === undefined)('createSupabaseSource', () => {
  const client = createClient(url ?? 'http://localhost', key, { realtime: { timeout: 5000 } })
  const source = createSupabaseSource({
    client,
    table: 'accounts',
    schema: conformanceSchema,
    today: CONFORMANCE_TODAY,
  })

  beforeAll(async () => {
    await client.from('accounts').delete().neq('id', '')
    const { error } = await client.from('accounts').insert([...conformanceRows])
    if (error !== null) throw new Error(error.message)
  })

  it('passes conformance for filters, search and pages', async () => {
    const report = await runConformance((request) => source.query(request), {
      capabilities: source.capabilities,
      cases: conformanceCases.filter((entry) => !(entry.requires ?? []).includes('sort')),
    })
    expect(report.failures).toEqual([])
  })

  it('sorts with empties last and ties broken by key', async () => {
    const response = await source.query({
      version: 1,
      sort: [{ column: 'mrr', direction: 'desc' }],
      page: { offset: 0, limit: 5 },
    })
    const values = response.rows.map((row) => row['mrr'])
    expect(values).toEqual(values.toSorted((a, b) => Number(b) - Number(a)))
    expect(response.total).toBe(conformanceRows.length)
  })

  it('mutates rows and relays realtime patches', async () => {
    const patches: RowPatch[] = []
    const stop = source.subscribe((patch) => patches.push(patch))
    await settle(patches)
    const result = await source.mutate([
      createMutation({
        label: 'edit',
        changes: [{ key: 'acc_001', column: 'account', from: 'Acme', to: 'Renamed' }],
        inserted: [{ row: { id: 'acc_new', account: 'New', plan: 'pro', active: true } }],
        deleted: [{ row: conformanceRows[1]!, index: 1 }],
      }),
    ])
    expect(result.accepted).toBe(true)
    expect(result.rows?.map((row) => [row['id'], row['account']])).toEqual([
      ['acc_001', 'Renamed'],
      ['acc_new', 'New'],
    ])
    await vi.waitFor(
      () => {
        expect(patches.flatMap((patch) => patch.deletes ?? [])).toEqual(['acc_002'])
        expect(
          patches.flatMap((patch) => patch.upserts ?? []).map((row) => row['account']),
        ).toEqual(expect.arrayContaining(['Renamed', 'New']))
      },
      { timeout: 10_000 },
    )
    stop()
    await client.removeAllChannels()
  }, 30_000)
})
