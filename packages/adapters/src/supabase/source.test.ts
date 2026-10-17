import { createClient } from '@supabase/supabase-js'
import { createMutation, createSchema, TallyError, type Filter, type RowPatch } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceCases,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createCompiler } from './compile.ts'
import { createSupabaseSource, type SupabaseSourceOptions } from './source.ts'

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

interface Step {
  readonly method: string
  readonly args: readonly unknown[]
}

interface Result {
  readonly data?: unknown
  readonly count?: number | null
  readonly error?: { readonly message: string } | null
}

type Respond = (steps: readonly Step[]) => Result

function fakeClient(respond: Respond = () => ({})) {
  const calls: Step[][] = []
  const handlers: Array<(payload: unknown) => void> = []
  const channels: string[] = []
  const removed: unknown[] = []
  const builder = (steps: Step[]): unknown =>
    new Proxy(
      {},
      {
        get: (_, method) => {
          if (method === 'then') {
            const { data = null, count = null, error = null } = respond(steps)
            return (resolve: (value: Result) => void) => resolve({ data, count, error })
          }
          return (...args: unknown[]) => {
            steps.push({ method: String(method), args })
            return builder(steps)
          }
        },
      },
    )
  const channel = {
    on: (_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return channel
    },
    subscribe: () => channel,
  }
  const client = Object.assign(createClient('http://supabase.test', 'anon'), {
    schema: (name: string) => ({
      from: (table: string) => {
        const steps: Step[] = [{ method: 'from', args: [name, table] }]
        calls.push(steps)
        return builder(steps)
      },
    }),
    channel: (name: string) => {
      channels.push(name)
      return channel
    },
    removeChannel: (value: unknown) => {
      removed.push(value)
      return Promise.resolve('ok' as const)
    },
  })
  return {
    client,
    calls,
    channels,
    removed,
    emit: (payload: unknown) => handlers.forEach((handler) => handler(payload)),
  }
}

function methods(steps: readonly Step[]): string[] {
  return steps.map((step) => step.method)
}

function stepOf(steps: readonly Step[], method: string): Step | undefined {
  return steps.find((step) => step.method === method)
}

const rows = conformanceRows.slice(0, 3)

function setupSource(options: Partial<SupabaseSourceOptions> = {}, respond?: Respond) {
  const fake = fakeClient(respond)
  const source = createSupabaseSource({
    client: fake.client,
    table: 'accounts',
    schema: conformanceSchema,
    today: CONFORMANCE_TODAY,
    ...options,
  })
  return { ...fake, source }
}

describe('createSupabaseSource with a stub client', () => {
  it('requires a key field', () => {
    const schema = createSchema({
      columns: [{ id: 'name', type: 'text' }],
      key: (row) => String(row['name']),
    })
    expect(() =>
      createSupabaseSource({ client: fakeClient().client, table: 'people', schema }),
    ).toThrow(TallyError)
  })

  it('advertises capabilities from options', () => {
    expect(setupSource().source.capabilities).toMatchObject({
      pagination: 'offset',
      mutate: true,
      live: true,
      group: false,
    })
    expect(
      setupSource({ pagination: 'cursor', mutable: false, realtime: false }).source.capabilities,
    ).toMatchObject({ pagination: 'cursor', mutate: false, live: false })
  })

  it('returns the schema columns', async () => {
    await expect(setupSource().source.schema()).resolves.toBe(conformanceSchema.columns)
  })

  it('builds a filtered, ordered, ranged query and reports totals', async () => {
    const { source, calls } = setupSource({ dbSchema: 'crm', maxLimit: 2 }, (steps) =>
      stepOf(steps, 'range') === undefined ? { count: 60 } : { data: rows, count: 12 },
    )
    const response = await source.query({
      version: 1,
      filter: { type: 'condition', column: 'plan', op: 'eq', value: 'pro' },
      sort: [{ column: 'mrr', direction: 'desc' }],
      page: { offset: 4, limit: 10 },
    })
    expect(response).toEqual({ rows, total: 60, matched: 12 })
    const [query, total] = calls
    expect(query?.[0]).toEqual({ method: 'from', args: ['crm', 'accounts'] })
    expect(methods(query ?? [])).toEqual(['from', 'select', 'or', 'order', 'order', 'range'])
    expect(stepOf(query ?? [], 'or')?.args).toEqual(['plan.eq."pro"'])
    expect(stepOf(query ?? [], 'range')?.args).toEqual([4, 5])
    expect(query?.filter((step) => step.method === 'order').map((step) => step.args)).toEqual([
      ['mrr', { ascending: false, nullsFirst: false }],
      ['id', { ascending: true, nullsFirst: false }],
    ])
    expect(stepOf(total ?? [], 'select')?.args).toEqual(['id', { count: 'exact', head: true }])
  })

  it('falls back to row counts when the database omits them', async () => {
    const { source, calls } = setupSource({}, () => ({ data: rows }))
    const response = await source.query({ version: 1, sort: [] })
    expect(response).toEqual({ rows, total: 3, matched: 3 })
    expect(methods(calls[0] ?? [])).not.toContain('range')
    const empty = setupSource({}, () => ({}))
    await expect(empty.source.query({ version: 1, sort: [] })).resolves.toEqual({
      rows: [],
      total: 0,
      matched: 0,
    })
  })

  it('pages with opaque cursors', async () => {
    const { source, calls } = setupSource({ pagination: 'cursor' }, () => ({
      data: rows,
      count: 5,
    }))
    const first = await source.query({ version: 1, sort: [], page: { limit: 3 } })
    expect(first.cursor).toEqual(expect.any(String))
    const second = await source.query({
      version: 1,
      sort: [],
      page: { cursor: first.cursor, limit: 3 },
    })
    expect(second.cursor).toBeUndefined()
    expect(stepOf(calls[2] ?? [], 'range')?.args).toEqual([3, 5])
  })

  it('treats malformed cursors as the first page', async () => {
    const { source, calls } = setupSource({ pagination: 'cursor' }, () => ({ data: [], count: 0 }))
    const cursors = ['%%%', btoa('null'), btoa('{"offset":-1}'), btoa('{"offset":"2"}')]
    await Promise.all(
      cursors.map((cursor) => source.query({ version: 1, sort: [], page: { cursor, limit: 2 } })),
    )
    expect(
      calls.filter((_, index) => index % 2 === 0).map((steps) => stepOf(steps, 'range')?.args),
    ).toEqual(cursors.map(() => [0, 1]))
  })

  it('rejects invalid requests and surfaces database errors', async () => {
    const { source } = setupSource()
    await expect(
      source.query({ version: 1, sort: [{ column: 'missing', direction: 'asc' }] }),
    ).rejects.toThrow(TallyError)
    const failing = setupSource({}, () => ({ error: { message: 'relation missing' } }))
    await expect(failing.source.query({ version: 1, sort: [] })).rejects.toThrow('relation missing')
  })

  it('writes deletes, inserts and merged updates with mapped column names', async () => {
    const { source, calls } = setupSource({ columns: { account: 'account_name' } }, (steps) =>
      stepOf(steps, 'select') === undefined ? {} : { data: [rows[0]] },
    )
    const result = await source.mutate([
      createMutation({
        label: 'edit',
        changes: [
          { key: 'acc_001', column: 'account', from: 'acme', to: 'Renamed' },
          { key: 'acc_001', column: 'seats', from: 1, to: 2 },
          { key: 'acc_003', column: 'seats', from: 15, to: 4 },
        ],
        inserted: [{ row: { id: 'acc_new', account: 'New' } }],
        deleted: [{ row: rows[1]!, index: 1 }],
      }),
    ])
    expect(result).toEqual({ accepted: true, rows: [rows[0]] })
    expect(calls.map((steps) => methods(steps).slice(1))).toEqual([
      ['delete', 'in'],
      ['insert'],
      ['update', 'eq'],
      ['update', 'eq'],
      ['select', 'in', 'order'],
    ])
    expect(stepOf(calls[0] ?? [], 'in')?.args).toEqual(['id', ['acc_002']])
    expect(stepOf(calls[1] ?? [], 'insert')?.args).toEqual([
      [{ id: 'acc_new', account_name: 'New' }],
    ])
    expect(calls.slice(2, 4).map((steps) => steps.slice(1).map((step) => step.args))).toEqual([
      [[{ account_name: 'Renamed', seats: 2 }], ['id', 'acc_001']],
      [[{ seats: 4 }], ['id', 'acc_003']],
    ])
    expect(stepOf(calls[4] ?? [], 'select')?.args).toEqual([
      'id,account:account_name,owner,plan,mrr,seats,score,growth,health,renewal,active,email,website,tenure',
    ])
    expect(stepOf(calls[4] ?? [], 'in')?.args).toEqual(['id', ['acc_001', 'acc_003', 'acc_new']])
  })

  it('skips the read back when nothing is left to read', async () => {
    const { source, calls } = setupSource()
    await expect(
      source.mutate([createMutation({ label: 'drop', deleted: [{ row: rows[0]!, index: 0 }] })]),
    ).resolves.toEqual({ accepted: true, rows: [] })
    expect(calls).toHaveLength(1)
  })

  it('refuses writes when read only or invalid', async () => {
    const { source, calls } = setupSource({ mutable: false })
    await expect(source.mutate([createMutation({ label: 'x' })])).resolves.toEqual({
      accepted: false,
      errors: [{ message: 'Source is read only' }],
    })
    const invalid = setupSource()
    const result = await invalid.source.mutate([
      createMutation({
        label: 'bad',
        changes: [{ key: 'acc_001', column: 'missing', from: 1, to: 2 }],
      }),
    ])
    expect(result.accepted).toBe(false)
    expect(result.errors?.length).toBeGreaterThan(0)
    expect([...calls, ...invalid.calls]).toEqual([])
  })

  it('reports database failures during writes and read back', async () => {
    const write = setupSource({}, () => ({ error: { message: 'denied' } }))
    await expect(
      write.source.mutate([
        createMutation({
          label: 'edit',
          changes: [{ key: 'acc_001', column: 'seats', from: 1, to: 2 }],
        }),
      ]),
    ).resolves.toEqual({ accepted: false, errors: [{ message: 'denied' }] })
    const read = setupSource({}, (steps) =>
      stepOf(steps, 'select') === undefined ? {} : { error: { message: 'gone' } },
    )
    await expect(
      read.source.mutate([
        createMutation({
          label: 'edit',
          changes: [{ key: 'acc_001', column: 'seats', from: 1, to: 2 }],
        }),
      ]),
    ).rejects.toThrow('gone')
  })

  it('relays realtime changes as row patches and removes the channel on stop', () => {
    const { source, emit, channels, removed } = setupSource({
      dbSchema: 'crm',
      columns: { account: 'account_name' },
    })
    const patches: RowPatch[] = []
    const stop = source.subscribe((patch) => patches.push(patch))
    expect(channels[0]).toMatch(/^tally:crm\.accounts:/)
    emit({ eventType: 'INSERT', new: { id: 'acc_009', account_name: 'Nine' }, old: {} })
    emit({ eventType: 'UPDATE', new: 'broken', old: {} })
    emit({ eventType: 'DELETE', new: {}, old: { id: 'acc_009' } })
    emit({ eventType: 'DELETE', new: {}, old: { id: true } })
    emit({ eventType: 'DELETE', new: {}, old: 'broken' })
    expect(patches).toHaveLength(2)
    expect(patches[0]?.upserts?.[0]).toMatchObject({ id: 'acc_009', account: 'Nine' })
    expect(patches[1]).toEqual({ deletes: ['acc_009'] })
    stop()
    expect(removed).toHaveLength(1)
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
