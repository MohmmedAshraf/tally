import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterAll, describe, expect, it } from 'vitest'
import { GUIDE_SOURCES } from './guides.ts'

describe('tally-mcp-server bin', () => {
  const client = new Client({ name: 'test', version: '0.0.0' })

  afterAll(() => client.close())

  it('serves every bundled guide over stdio', async () => {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [fileURLToPath(new URL('../dist/bin.js', import.meta.url))],
      }),
    )
    const listed = await client.listResources()
    const guides = listed.resources
      .map((resource) => resource.uri)
      .filter((uri) => uri.startsWith('tally://guide/'))
    expect(guides).toEqual([
      ...Object.keys(GUIDE_SOURCES).map((name) => `tally://guide/${name}`),
      'tally://guide/extend',
    ])
    const overview = await client.readResource({ uri: 'tally://guide/overview' })
    expect(overview.contents[0]).toHaveProperty('text', expect.stringContaining('Tally'))
  })
})
