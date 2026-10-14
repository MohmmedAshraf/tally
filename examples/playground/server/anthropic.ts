const UPSTREAM = 'https://api.anthropic.com'
const FORWARDED = ['content-type', 'accept', 'anthropic-version', 'anthropic-beta']
const DECODED = ['content-encoding', 'content-length', 'transfer-encoding']

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export function createAnthropicProxy(): (request: Request) => Promise<Response> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  const available = apiKey !== undefined && apiKey !== ''
  return async (request) => {
    const url = new URL(request.url)
    if (url.pathname === '/' || url.pathname === '') return json({ available })
    if (!available) return json({ message: 'ANTHROPIC_API_KEY is not set' }, 503)
    const headers = new Headers({ 'x-api-key': apiKey })
    for (const name of FORWARDED) {
      const value = request.headers.get(name)
      if (value !== null) headers.set(name, value)
    }
    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      ...(request.method === 'GET' || request.method === 'HEAD'
        ? {}
        : { body: await request.arrayBuffer() }),
    })
    const responseHeaders = new Headers(upstream.headers)
    for (const name of DECODED) responseHeaders.delete(name)
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  }
}
