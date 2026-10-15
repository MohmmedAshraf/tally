#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { GUIDE_SOURCES } from './guides.ts'
import { createTallyServer } from './server.ts'

const dir = new URL('./guides/', import.meta.url)
const entries = await Promise.all(
  Object.keys(GUIDE_SOURCES).map(
    async (name) => [name, await readFile(new URL(`${name}.md`, dir), 'utf8')] as const,
  ),
)
const server = createTallyServer({ guides: Object.fromEntries(entries) })
await server.connect(new StdioServerTransport())
