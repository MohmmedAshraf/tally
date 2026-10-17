import { readFile } from 'node:fs/promises'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { createTallyServer } from 'tally-mcp-server'

const server = createTallyServer({
  guides: {
    core: await readFile('node_modules/tally-core/README.md', 'utf8'),
    react: await readFile('node_modules/tally-react/README.md', 'utf8'),
  },
})

await server.connect(new StdioServerTransport())
