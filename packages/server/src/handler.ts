import {
  TallyError,
  type DataSource,
  type Mutation,
  type MutationResult,
  type RowPatch,
  type Schema,
} from 'tally-core'
import { validateMutationRequest, validateQueryRequest, type SchemaResponse } from 'tally-protocol'

export interface TallyHandlerOptions {
  readonly source: DataSource
  readonly schema: Schema
  readonly basePath?: string | undefined
  readonly heartbeatMs?: number | undefined
  readonly maxBodyBytes?: number | undefined
  readonly onError?: ((error: unknown) => void) | undefined
}

export type TallyHandler = (request: Request) => Promise<Response>

interface ErrorBody {
  readonly code: string
  readonly message: string
  readonly details: readonly string[]
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function failure(status: number, body: ErrorBody): Response {
  return json(body, status)
}

const MAX_PENDING_EVENTS = 1024

class BodyTooLarge extends Error {}

async function readText(request: Request, maxBytes: number): Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new BodyTooLarge()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  for await (const chunk of request.body ?? []) {
    size += chunk.byteLength
    if (size > maxBytes) throw new BodyTooLarge()
    text += decoder.decode(chunk, { stream: true })
  }
  return text + decoder.decode()
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const text = await readText(request, maxBytes)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new TallyError('invalid_query', 'Request body is not valid JSON')
  }
}

type Subscribe = (onPatch: (patch: RowPatch) => void) => () => void

interface Broadcaster {
  readonly subscribe: Subscribe
  readonly publish: (patch: RowPatch) => void
}

function broadcaster(source: DataSource): Broadcaster {
  const listeners = new Set<(patch: RowPatch) => void>()
  return {
    publish: (patch) => {
      for (const listener of listeners) listener(patch)
    },
    subscribe: (onPatch) => {
      listeners.add(onPatch)
      const stopLive = source.subscribe?.(onPatch)
      return () => {
        listeners.delete(onPatch)
        stopLive?.()
      }
    },
  }
}

function patchOf(
  mutations: readonly Mutation[],
  result: MutationResult,
  schema: Schema,
): RowPatch | undefined {
  const upserts = result.rows ?? []
  const deletes = [
    ...new Set(
      mutations.flatMap((mutation) => mutation.deleted.map((removal) => schema.keyOf(removal.row))),
    ),
  ]
  if (upserts.length === 0 && deletes.length === 0) return undefined
  return {
    ...(upserts.length === 0 ? {} : { upserts }),
    ...(deletes.length === 0 ? {} : { deletes }),
  }
}

function events(subscribe: Subscribe, request: Request, heartbeatMs: number): Response {
  const encoder = new TextEncoder()
  let release: (() => void) | undefined
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let open = true
        const send = (text: string): void => {
          if (!open) return
          if ((controller.desiredSize ?? 0) <= 0) {
            release?.()
            controller.error(new Error('Event stream consumer fell behind'))
            return
          }
          controller.enqueue(encoder.encode(text))
        }
        const stop = subscribe((patch) => send(`event: patch\ndata: ${JSON.stringify(patch)}\n\n`))
        const beat = setInterval(() => send(': ping\n\n'), heartbeatMs)
        const onAbort = (): void => {
          release?.()
          controller.close()
        }
        release = () => {
          if (!open) return
          open = false
          stop()
          clearInterval(beat)
          request.signal.removeEventListener('abort', onAbort)
        }
        if (request.signal.aborted) onAbort()
        else request.signal.addEventListener('abort', onAbort)
      },
      cancel() {
        release?.()
      },
    },
    new CountQueuingStrategy({ highWaterMark: MAX_PENDING_EVENTS }),
  )
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  })
}

export function createTallyHandler(options: TallyHandlerOptions): TallyHandler {
  const { source, schema } = options
  const basePath = (options.basePath ?? '').replace(/\/$/, '')
  const heartbeatMs = options.heartbeatMs ?? 15_000
  const maxBodyBytes = options.maxBodyBytes ?? 1_048_576
  const live = broadcaster(source)
  const routes: Readonly<
    Record<string, Readonly<Record<string, (request: Request) => Promise<Response> | Response>>>
  > = {
    '/schema': {
      GET: () => {
        const body: SchemaResponse = {
          version: 1,
          columns: schema.columns,
          capabilities: { ...source.capabilities, live: true },
          ...(schema.keyField === undefined ? {} : { key: schema.keyField }),
        }
        return json(body)
      },
    },
    '/query': {
      POST: async (request) => {
        const query = validateQueryRequest(await readJson(request, maxBodyBytes), schema)
        return json(await source.query(query, request.signal))
      },
    },
    '/rows': {
      PATCH: async (request) => {
        const mutate = source.mutate?.bind(source)
        if (mutate === undefined || !source.capabilities.mutate) {
          return failure(405, { code: 'read_only', message: 'Source is read only', details: [] })
        }
        const mutation = validateMutationRequest(await readJson(request, maxBodyBytes), schema)
        const result = await mutate(mutation.mutations)
        const patch = result.accepted ? patchOf(mutation.mutations, result, schema) : undefined
        if (patch !== undefined) live.publish(patch)
        return json(result)
      },
    },
    '/events': {
      GET: (request) => events(live.subscribe, request, heartbeatMs),
    },
  }
  return async (request) => {
    const path = new URL(request.url).pathname
    if (!path.startsWith(basePath)) {
      return failure(404, { code: 'not_found', message: 'Not found', details: [] })
    }
    const routePath = path.slice(basePath.length)
    const route = Object.hasOwn(routes, routePath) ? routes[routePath] : undefined
    if (route === undefined) {
      return failure(404, { code: 'not_found', message: 'Not found', details: [] })
    }
    const handle = Object.hasOwn(route, request.method) ? route[request.method] : undefined
    if (handle === undefined) {
      return new Response(null, { status: 405, headers: { allow: Object.keys(route).join(', ') } })
    }
    try {
      return await handle(request)
    } catch (error) {
      if (error instanceof TallyError) {
        return failure(400, { code: error.code, message: error.message, details: error.details })
      }
      if (error instanceof BodyTooLarge) {
        return failure(413, {
          code: 'too_large',
          message: 'Request body is too large',
          details: [],
        })
      }
      options.onError?.(error)
      return failure(500, { code: 'internal', message: 'Internal error', details: [] })
    }
  }
}
