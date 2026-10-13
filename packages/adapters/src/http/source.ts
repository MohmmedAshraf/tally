import { EventSource } from 'eventsource'
import {
  createSchema,
  type Capabilities,
  type DataSource,
  type Mutation,
  type MutationResult,
  type QueryRequest,
  type QueryResponse,
  type RowPatch,
  type Schema,
  type TypeRegistry,
} from 'tally-core'
import {
  mutationResultSchema,
  queryResponseSchema,
  rowPatchSchema,
  schemaResponseSchema,
  type MutationRequest,
  type SchemaResponse,
} from 'tally-protocol'
import type { z } from 'zod'
import { errorFrom } from './error.ts'

export type HttpHeaders = HeadersInit | (() => HeadersInit | Promise<HeadersInit>)

export interface HttpTransportOptions {
  readonly url: string
  readonly fetch?: typeof fetch | undefined
  readonly headers?: HttpHeaders | undefined
}

export interface HttpSourceOptions extends HttpTransportOptions {
  readonly capabilities: Capabilities
}

export interface HttpSource extends DataSource {
  readonly url: string
}

export interface ConnectHttpSourceOptions extends HttpTransportOptions {
  readonly registry?: TypeRegistry | undefined
}

export interface HttpConnection {
  readonly schema: Schema
  readonly source: HttpSource
}

interface Transport {
  readonly url: (path: string) => string
  readonly send: <T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ) => Promise<T>
  readonly headers: (base?: HeadersInit) => Promise<Headers>
  readonly fetch: typeof fetch
}

async function resolveHeaders(
  headers: HttpHeaders | undefined,
  base?: HeadersInit,
): Promise<Headers> {
  const merged = new Headers(base)
  const own = typeof headers === 'function' ? await headers() : headers
  new Headers(own).forEach((value, name) => merged.set(name, value))
  return merged
}

function createTransport(options: HttpTransportOptions): Transport {
  const base = options.url.replace(/\/$/, '')
  const call = options.fetch ?? globalThis.fetch.bind(globalThis)
  const url = (path: string): string => `${base}${path}`
  const headers = (init?: HeadersInit): Promise<Headers> => resolveHeaders(options.headers, init)
  return {
    url,
    fetch: call,
    headers,
    send: async (path, init, schema, signal) => {
      const response = await call(url(path), {
        ...init,
        headers: await headers(init.headers),
        ...(signal === undefined ? {} : { signal }),
      })
      if (!response.ok) throw await errorFrom(response)
      return schema.parse((await response.json()) as unknown)
    },
  }
}

const JSON_HEADERS: HeadersInit = { accept: 'application/json', 'content-type': 'application/json' }

type Subscribe = (onPatch: (patch: RowPatch) => void) => () => void

function subscribeEvents(transport: Transport): Subscribe {
  return (onPatch) => {
    const stream = new EventSource(transport.url('/events'), {
      fetch: async (url, init) =>
        transport.fetch(url, { ...init, headers: await transport.headers(init.headers) }),
    })
    stream.addEventListener('patch', (event: MessageEvent) => {
      const parsed = rowPatchSchema.safeParse(JSON.parse(String(event.data)))
      if (parsed.success) onPatch(parsed.data)
    })
    return () => stream.close()
  }
}

export function createHttpSource(options: HttpSourceOptions): HttpSource {
  const transport = createTransport(options)
  const { capabilities } = options
  const query = (request: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> =>
    transport.send(
      '/query',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) },
      queryResponseSchema,
      signal,
    )
  const mutate = (mutations: readonly Mutation[]): Promise<MutationResult> => {
    const body: MutationRequest = { version: 1, mutations }
    return transport.send(
      '/rows',
      { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) },
      mutationResultSchema,
    )
  }
  return {
    url: transport.url(''),
    capabilities,
    query,
    ...(capabilities.mutate ? { mutate } : {}),
    ...(capabilities.live ? { subscribe: subscribeEvents(transport) } : {}),
  }
}

export function fetchSchema(options: HttpTransportOptions): Promise<SchemaResponse> {
  return createTransport(options).send(
    '/schema',
    { method: 'GET', headers: { accept: 'application/json' } },
    schemaResponseSchema,
  )
}

export async function connectHttpSource(
  options: ConnectHttpSourceOptions,
): Promise<HttpConnection> {
  const { registry, ...transport } = options
  const remote = await fetchSchema(transport)
  const schema = createSchema({ columns: remote.columns, key: remote.key, registry })
  return { schema, source: createHttpSource({ ...transport, capabilities: remote.capabilities }) }
}
