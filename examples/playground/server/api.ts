import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono, type Context } from 'hono'
import { mount } from 'hono/mount'
import { createAnthropicProxy } from './anthropic.ts'
import { createPlaygroundHandler } from './tally.ts'

function clientAddress(header: string | undefined): (c: Context) => string {
  return (c) =>
    (header === undefined ? undefined : c.req.header(header)) ??
    getConnInfo(c).remote.address ??
    'unknown'
}

function withoutPrefix(prefix: string): (request: Request) => Request {
  return (request) => {
    const url = new URL(request.url)
    url.pathname = url.pathname.slice(prefix.length) || '/'
    const init: RequestInit & { duplex: 'half' } = {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: request.signal,
      duplex: 'half',
    }
    return new Request(url, init)
  }
}

export async function createApi(
  onError: (error: unknown) => void,
  clientIpHeader?: string,
): Promise<Hono> {
  const tally = await createPlaygroundHandler(onError)
  const anthropic = createAnthropicProxy()
  return new Hono()
    .all('/api/tally/*', mount(tally, { replaceRequest: withoutPrefix('/api/tally') }))
    .all(
      '/api/anthropic/*',
      mount(anthropic, {
        replaceRequest: withoutPrefix('/api/anthropic'),
        optionHandler: clientAddress(clientIpHeader),
      }),
    )
    .all('/api/*', (c) => c.body(null, 404))
    .onError((error, c) => {
      onError(error)
      return c.body(null, 500)
    })
}
