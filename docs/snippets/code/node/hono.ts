import { Hono } from 'hono'
import { createTallyHandler } from 'tally-server'
import { accounts, schema } from './adapter.ts'

const handler = createTallyHandler({ source: accounts, schema, basePath: '/api/accounts' })

export const app = new Hono().all('/api/accounts/*', (c) => handler(c.req.raw))
