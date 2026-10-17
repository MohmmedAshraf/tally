import { createServer } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { createTallyHandler } from 'tally-server'
import { accounts, schema } from './adapter.ts'

const handler = createTallyHandler({ source: accounts, schema, basePath: '/api/accounts' })
const listener = getRequestListener(handler)

export const server = createServer((request, response) => {
  void listener(request, response)
}).listen(3000)
