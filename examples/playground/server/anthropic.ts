const UPSTREAM = 'https://api.anthropic.com'
const MESSAGES_PATH = '/v1/messages'
const FORWARDED = ['content-type', 'accept', 'anthropic-version', 'anthropic-beta']
const DECODED = ['content-encoding', 'content-length', 'transfer-encoding']
const MAX_BODY_BYTES = 1_048_576
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const DAILY_LIMIT = 150
const DAY_MS = 86_400_000
const MAX_OUTPUT_TOKENS = 512
const MODELS = new Set(['claude-haiku-5-5'])

export type AnthropicProxy = (request: Request, client: string) => Promise<Response>

interface RateWindow {
  readonly start: number
  count: number
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers })
}

function createRateLimiter(
  limit: number,
  windowMs: number,
): (client: string) => number | undefined {
  const windows = new Map<string, RateWindow>()
  return (client) => {
    const time = Date.now()
    for (const [key, window] of windows) {
      if (time - window.start >= windowMs) windows.delete(key)
    }
    const window = windows.get(client) ?? { start: time, count: 0 }
    windows.set(client, window)
    if (window.count >= limit) return Math.ceil((window.start + windowMs - time) / 1000)
    window.count += 1
    return undefined
  }
}

function boundedMessages(body: Uint8Array): string | undefined {
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body).toString('utf8'))
  } catch {
    return undefined
  }
  if (typeof payload !== 'object' || payload === null) return undefined
  const { model, max_tokens: maxTokens } = payload as { model?: unknown; max_tokens?: unknown }
  if (typeof model !== 'string' || !MODELS.has(model)) return undefined
  const requested = typeof maxTokens === 'number' ? maxTokens : MAX_OUTPUT_TOKENS
  return JSON.stringify({ ...payload, max_tokens: Math.min(requested, MAX_OUTPUT_TOKENS) })
}

async function readBody(request: Request, maxBytes: number): Promise<Uint8Array | undefined> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return undefined
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request.body ?? []) {
    size += chunk.byteLength
    if (size > maxBytes) return undefined
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function createAnthropicProxy(): AnthropicProxy {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  const available = apiKey !== undefined && apiKey !== ''
  const limited = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS)
  const exhausted = createRateLimiter(DAILY_LIMIT, DAY_MS)
  return async (request, client) => {
    const { pathname, search } = new URL(request.url)
    if (pathname === '/' || pathname === '') {
      return request.method === 'GET'
        ? json({ available })
        : new Response(null, { status: 405, headers: { allow: 'GET' } })
    }
    if (pathname !== MESSAGES_PATH) return json({ message: 'Not found' }, 404)
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } })
    }
    if (!available) return json({ message: 'ANTHROPIC_API_KEY is not set' }, 503)
    const retryAfter = exhausted(client) ?? limited(client)
    if (retryAfter !== undefined) {
      return json({ message: 'Too many requests' }, 429, { 'retry-after': String(retryAfter) })
    }
    const raw = await readBody(request, MAX_BODY_BYTES)
    if (raw === undefined) return json({ message: 'Request body is too large' }, 413)
    const body = boundedMessages(raw)
    if (body === undefined) return json({ message: 'Unsupported request' }, 400)
    const headers = new Headers({ 'x-api-key': apiKey })
    for (const name of FORWARDED) {
      const value = request.headers.get(name)
      if (value !== null) headers.set(name, value)
    }
    const upstream = await fetch(`${UPSTREAM}${MESSAGES_PATH}${search}`, {
      method: 'POST',
      headers,
      body,
      signal: request.signal,
    })
    const responseHeaders = new Headers(upstream.headers)
    for (const name of DECODED) responseHeaders.delete(name)
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  }
}
