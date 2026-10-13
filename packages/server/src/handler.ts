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

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown
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
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = subscribe((patch) => {
        controller.enqueue(encoder.encode(`event: patch\ndata: ${JSON.stringify(patch)}\n\n`))
      })
      const beat = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), heartbeatMs)
      request.signal.addEventListener('abort', () => {
        stop()
        clearInterval(beat)
        controller.close()
      })
    },
  })
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
  const live = broadcaster(source)
  const routes: Readonly<
    Record<string, Readonly<Record<string, (request: Request) => Promise<Response> | Response>>>
  > = {
    '/schema': {
      GET: () => {
        const body: SchemaResponse = {
          version: 1,
          columns: schema.columns,
          capabilities: source.capabilities,
          ...(schema.keyField === undefined ? {} : { key: schema.keyField }),
        }
        return json(body)
      },
    },
    '/query': {
      POST: async (request) => {
        const query = validateQueryRequest(await readJson(request), schema)
        return json(await source.query(query, request.signal))
      },
    },
    '/rows': {
      PATCH: async (request) => {
        const mutate = source.mutate?.bind(source)
        if (mutate === undefined || !source.capabilities.mutate) {
          return failure(405, { code: 'read_only', message: 'Source is read only', details: [] })
        }
        const mutation = validateMutationRequest(await readJson(request), schema)
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
    const route = routes[path.slice(basePath.length)]
    if (route === undefined) {
      return failure(404, { code: 'not_found', message: 'Not found', details: [] })
    }
    const handle = route[request.method]
    if (handle === undefined) {
      return new Response(null, { status: 405, headers: { allow: Object.keys(route).join(', ') } })
    }
    try {
      return await handle(request)
    } catch (error) {
      if (error instanceof TallyError) {
        return failure(400, { code: error.code, message: error.message, details: error.details })
      }
      return failure(500, {
        code: 'internal',
        message: error instanceof Error ? error.message : 'Internal error',
        details: [],
      })
    }
  }
}
