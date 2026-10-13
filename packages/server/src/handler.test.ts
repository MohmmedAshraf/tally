import { createArraySource, createMutation, createSchema } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { createTallyHandler } from './handler.ts'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }],
})

const rows = [
  { id: 1, name: 'One', mrr: 10 },
  { id: 2, name: 'Two', mrr: 20 },
]

function setup(basePath?: string) {
  const source = createArraySource(rows, schema)
  const handler = createTallyHandler({ source, schema, basePath, heartbeatMs: 10 })
  const call = (path: string, init?: RequestInit): Promise<Response> =>
    handler(new Request(`http://tally.test${basePath ?? ''}${path}`, init))
  return { source, handler, call }
}

async function payload(response: Response): Promise<unknown> {
  return (await response.json()) as unknown
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  marker: string,
  text = '',
): Promise<string> {
  if (text.includes(marker)) return text
  const chunk = await reader.read()
  if (chunk.done) return text
  return readUntil(reader, marker, text + new TextDecoder().decode(chunk.value))
}

function post(body: unknown, method = 'POST'): RequestInit {
  return { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
}

describe('createTallyHandler', () => {
  it('serves the schema', async () => {
    const { call, source } = setup('/api/tally')
    const response = await call('/schema')
    expect(response.status).toBe(200)
    expect(await payload(response)).toEqual({
      version: 1,
      columns: schema.columns,
      capabilities: { ...source.capabilities, live: true },
      key: 'id',
    })
  })

  it('answers queries and rejects invalid ones with details', async () => {
    const { call } = setup()
    const ok = await call(
      '/query',
      post({
        version: 1,
        sort: [{ column: 'mrr', direction: 'desc' }],
        page: { offset: 0, limit: 1 },
      }),
    )
    expect(await payload(ok)).toMatchObject({ rows: [{ id: 2 }], total: 2, matched: 2 })
    const bad = await call(
      '/query',
      post({ version: 1, sort: [{ column: 'x', direction: 'asc' }] }),
    )
    expect(bad.status).toBe(400)
    expect(await payload(bad)).toEqual({
      code: 'invalid_query',
      message: 'Query request is invalid',
      details: ['sort.0.column: unknown column "x"'],
    })
    const broken = await call('/query', { method: 'POST', body: '{nope' })
    expect(broken.status).toBe(400)
    expect(await payload(broken)).toMatchObject({ message: 'Request body is not valid JSON' })
  })

  it('applies mutations and streams patches as server sent events', async () => {
    const { call } = setup()
    const controller = new AbortController()
    const stream = await call('/events', { signal: controller.signal })
    expect(stream.headers.get('content-type')).toBe('text/event-stream')
    const reader = stream.body?.getReader()
    const mutation = createMutation({
      label: 'Edit',
      changes: [{ key: 1, column: 'mrr', from: 10, to: 15 }],
      deleted: [{ row: { id: 2, name: 'Two', mrr: 20 }, index: 1 }],
    })
    const patched = await call('/rows', post({ version: 1, mutations: [mutation] }, 'PATCH'))
    expect(await payload(patched)).toEqual({
      accepted: true,
      rows: [{ id: 1, name: 'One', mrr: 15 }],
    })
    const text = reader === undefined ? '' : await readUntil(reader, 'event: patch')
    const data = /data: (.*)\n/.exec(text)?.[1]
    const patch = JSON.parse(data ?? '{}') as unknown
    expect(patch).toEqual({ upserts: [{ id: 1, name: 'One', mrr: 15 }], deletes: [2] })
    controller.abort()
  })

  it('returns 404 and 405 for unknown routes and methods', async () => {
    const { call } = setup('/t')
    expect((await call('/nope')).status).toBe(404)
    const wrong = await call('/query')
    expect(wrong.status).toBe(405)
    expect(wrong.headers.get('allow')).toBe('POST')
    const outside = await createTallyHandler({
      source: createArraySource(rows, schema),
      schema,
      basePath: '/t',
    })(new Request('http://tally.test/other/query', post({ version: 1, sort: [] })))
    expect(outside.status).toBe(404)
  })

  it('refuses mutations on read only sources', async () => {
    const source = createArraySource(rows, schema, { mutable: false })
    const handler = createTallyHandler({ source, schema })
    const response = await handler(
      new Request('http://tally.test/rows', post({ version: 1, mutations: [] }, 'PATCH')),
    )
    expect(response.status).toBe(405)
  })
})
