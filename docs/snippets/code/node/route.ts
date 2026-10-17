import { createTallyHandler } from 'tally-server'
import { accounts, schema } from './adapter.ts'

const handler = createTallyHandler({ source: accounts, schema, basePath: '/api/accounts' })

export { handler as GET, handler as PATCH, handler as POST }
