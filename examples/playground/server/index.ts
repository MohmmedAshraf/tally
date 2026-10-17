import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { compress } from 'hono/compress'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { createApi } from './api.ts'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env['PORT'] ?? 8080)

const logError = (error: unknown): void => {
  process.stderr.write(`${inspect(error)}\n`)
}

function cacheControl(_: string, c: Context): void {
  c.header(
    'cache-control',
    c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  )
}

const app = new Hono()
  .use(logger())
  .use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    }),
  )
  .get('/healthz', (c) => c.text('ok'))
  .route('/', await createApi(logError))
  .use(compress())
  .use(serveStatic({ root, onFound: cacheControl }))
  .all('/assets/*', (c) => c.body(null, 404))
  .get('*', serveStatic({ root, path: 'index.html', onFound: cacheControl }))
  .onError((error, c) => {
    logError(error)
    return c.body(null, 500)
  })

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`Listening on http://localhost:${info.port}\n`)
})
