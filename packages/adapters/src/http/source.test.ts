import {
  createArraySource,
  createMutation,
  type Capabilities,
  type Pagination,
  type RowPatch,
} from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { createTallyHandler, type TallyHandler } from 'tally-server'
import { describe, expect, it, vi } from 'vitest'
import { HttpSourceError } from './error.ts'
import { connectHttpSource, createHttpSource } from './source.ts'

const URL_BASE = 'http://tally.test/api/tally'

interface Served {
  readonly fetch: typeof fetch
  readonly seen: Request[]
}

function serve(handler: TallyHandler): Served {
  const seen: Request[] = []
  return {
    seen,
    fetch: (input, init) => {
      if (init?.signal?.aborted === true) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      }
      const request = new Request(input, init)
      seen.push(request)
      return handler(request)
    },
  }
}

function setup(pagination: Pagination = 'none', mutable = true): Served {
  const source = createArraySource(conformanceRows, conformanceSchema, {
    today: CONFORMANCE_TODAY,
    pagination,
    mutable,
  })
  return serve(
    createTallyHandler({
      source,
      schema: conformanceSchema,
      basePath: '/api/tally',
      heartbeatMs: 10,
    }),
  )
}

const full: Capabilities = {
  filter: true,
  sort: true,
  group: true,
  search: true,
  aggregates: true,
  facets: true,
  pagination: 'none',
  mutate: true,
  live: true,
}

describe('connectHttpSource', () => {
  it('builds a schema and a source from the schema route', async () => {
    const served = setup('offset')
    const { schema, source } = await connectHttpSource({ url: `${URL_BASE}/`, fetch: served.fetch })
    expect(schema.columns).toEqual(conformanceSchema.columns)
    expect(schema.keyField).toBe('id')
    expect(source.capabilities).toEqual({ ...full, pagination: 'offset' })
    expect(source.url).toBe(URL_BASE)
    expect(served.seen[0]?.url).toBe(`${URL_BASE}/schema`)
  })

  it('sends resolved headers with every request', async () => {
    const served = setup()
    const { source } = await connectHttpSource({
      url: URL_BASE,
      fetch: served.fetch,
      headers: () => Promise.resolve({ authorization: 'Bearer token' }),
    })
    await source.query({ version: 1, sort: [] })
    expect(served.seen.map((request) => request.headers.get('authorization'))).toEqual([
      'Bearer token',
      'Bearer token',
    ])
    expect(served.seen[1]?.headers.get('content-type')).toBe('application/json')
  })
})

describe('createHttpSource', () => {
  it.each<Pagination>(['none', 'offset', 'cursor'])(
    'passes conformance with %s pagination',
    async (pagination) => {
      const served = setup(pagination)
      const source = createHttpSource({
        url: URL_BASE,
        fetch: served.fetch,
        capabilities: { ...full, pagination },
      })
      const report = await runConformance((request) => source.query(request), {
        capabilities: source.capabilities,
      })
      expect(report.failures).toEqual([])
    },
  )

  it('maps protocol errors to HttpSourceError with details', async () => {
    const served = setup()
    const source = createHttpSource({ url: URL_BASE, fetch: served.fetch, capabilities: full })
    const failure = source.query({
      version: 1,
      sort: [{ column: 'missing', direction: 'asc' }],
    })
    await expect(failure).rejects.toBeInstanceOf(HttpSourceError)
    await expect(failure).rejects.toMatchObject({
      status: 400,
      code: 'invalid_query',
      details: ['sort.0.column: unknown column "missing"'],
    })
  })

  it('wraps non protocol failures', async () => {
    const source = createHttpSource({
      url: URL_BASE,
      fetch: () =>
        Promise.resolve(new Response('gateway', { status: 502, statusText: 'Bad Gateway' })),
      capabilities: full,
    })
    await expect(source.query({ version: 1, sort: [] })).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
      message: 'Bad Gateway',
    })
  })

  it('forwards the abort signal', async () => {
    const served = setup()
    const source = createHttpSource({ url: URL_BASE, fetch: served.fetch, capabilities: full })
    const controller = new AbortController()
    controller.abort()
    await expect(source.query({ version: 1, sort: [] }, controller.signal)).rejects.toThrow(
      'Aborted',
    )
  })

  it('mutates through the rows route and receives patches over events', async () => {
    const served = setup()
    const writer = createHttpSource({ url: URL_BASE, fetch: served.fetch, capabilities: full })
    const reader = createHttpSource({ url: URL_BASE, fetch: served.fetch, capabilities: full })
    const patches: RowPatch[] = []
    const stop = reader.subscribe!((patch) => patches.push(patch))
    await vi.waitFor(() => {
      expect(served.seen.some((request) => request.url.endsWith('/events'))).toBe(true)
    })
    const [first, second] = conformanceRows
    const mutation = createMutation({
      label: 'edit',
      changes: [{ key: 'acc_001', column: 'account', from: first!['account'], to: 'Renamed' }],
      deleted: [{ row: second!, index: 1 }],
    })
    const result = await writer.mutate!([mutation])
    expect(result.accepted).toBe(true)
    expect(result.rows?.map((row) => row['account'])).toEqual(['Renamed'])
    await vi.waitFor(() => {
      expect(patches).toEqual([{ upserts: result.rows, deletes: ['acc_002'] }])
    })
    stop()
  })

  it('omits mutate and subscribe when the server lacks them', () => {
    const served = setup('none', false)
    const source = createHttpSource({
      url: URL_BASE,
      fetch: served.fetch,
      capabilities: { ...full, mutate: false, live: false },
    })
    expect('mutate' in source).toBe(false)
    expect('subscribe' in source).toBe(false)
  })
})
