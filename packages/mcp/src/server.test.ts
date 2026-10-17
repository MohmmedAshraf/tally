import { readFile } from 'node:fs/promises'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import { GUIDE_SOURCES } from './guides.ts'
import { createTallyServer } from './server.ts'

async function connect(): Promise<Client> {
  const entries = await Promise.all(
    Object.entries(GUIDE_SOURCES).map(
      async ([name, file]) =>
        [name, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')] as const,
    ),
  )
  const server = createTallyServer({ guides: Object.fromEntries(entries) })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}

const columns = [
  { id: 'account', label: 'Account' },
  { id: 'plan', type: 'enum', options: [{ value: 'pro' }, { value: 'team' }] },
  { id: 'mrr', type: 'currency' },
]

const textContent = z.array(z.object({ type: z.literal('text'), text: z.string() }))

function textOf(result: { content: unknown }): string {
  return textContent.parse(result.content)[0]?.text ?? ''
}

function json<T>(schema: z.ZodType<T>, result: { content: unknown }): T {
  return schema.parse(JSON.parse(textOf(result)))
}

const inferredSchema = z.object({
  key: z.string().optional(),
  columns: z.array(z.object({ id: z.string(), type: z.string() })),
  issues: z.array(z.string()),
})
const matchesSchema = z.object({ matches: z.array(z.object({ id: z.string() })) })
const validatedSchema = z.object({ valid: z.boolean(), issues: z.array(z.string()) })
const parsedSchema = z.object({ ok: z.boolean(), printed: z.string().optional() })

function contentOf(result: { contents: readonly ({ text: string } | { blob: string })[] }): string {
  const [first] = result.contents
  return first !== undefined && 'text' in first ? first.text : ''
}

describe('tally-mcp-server', () => {
  it('lists guides and schemas as resources', async () => {
    const client = await connect()
    const listed = await client.listResources()
    const uris = listed.resources.map((resource) => resource.uri)
    expect(uris).toContain('tally://guide/overview')
    expect(uris).toContain('tally://guide/extend')
    expect(uris).toContain('tally://schema/query-request')
    const guide = await client.readResource({ uri: 'tally://guide/react' })
    expect(contentOf(guide)).toContain('# tally-react')
    const schema = await client.readResource({ uri: 'tally://schema/query-request' })
    expect(JSON.parse(contentOf(schema))).toHaveProperty('$schema')
  })

  it('points a change at its extension point', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'tally_where',
      arguments: { change: 'show health as a ring instead of a bar' },
    })
    expect(matchesSchema.parse(result.structuredContent).matches[0]?.id).toBe('renderer')
    const backend = await client.callTool({
      name: 'tally_where',
      arguments: { change: 'serve rows from postgres with hono' },
    })
    expect(matchesSchema.parse(backend.structuredContent).matches[0]?.id).toBe('sql-backend')
  })

  it('searches guide sections', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'tally_search',
      arguments: { query: 'cursor pagination' },
    })
    expect(textOf(result)).toContain('tally://guide/')
  })

  it('parses and prints query text', async () => {
    const client = await connect()
    const ok = await client.callTool({
      name: 'tally_parse_query',
      arguments: { text: 'plan is pro or team and mrr > 2k sort by mrr desc', columns },
    })
    const parsed = json(parsedSchema, ok)
    expect(parsed.ok).toBe(true)
    expect(parsed.printed).toContain('sort by mrr desc')
    const bad = await client.callTool({
      name: 'tally_parse_query',
      arguments: { text: 'plan is gold', columns },
    })
    expect(json(parsedSchema, bad).ok).toBe(false)
  })

  it('validates protocol requests', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'tally_validate_request',
      arguments: {
        kind: 'query',
        request: { version: 1, sort: [{ column: 'missing', direction: 'asc' }] },
        columns,
      },
    })
    const structured = validatedSchema.parse(result.structuredContent)
    expect(structured.valid).toBe(false)
    expect(structured.issues[0]).toContain('missing')
  })

  it('infers a schema from rows and csv', async () => {
    const client = await connect()
    const fromRows = await client.callTool({
      name: 'tally_infer_schema',
      arguments: {
        rows: [
          { id: 1, name: 'Acme', mrr: '$1,200', plan: 'pro', tags: ['a'] },
          { id: 2, name: 'Globex', mrr: '$900', plan: 'team' },
          { id: 3, name: 'Initech', mrr: '$300', plan: 'pro' },
          { id: 4, name: 'Umbrella', mrr: '$80', plan: 'team' },
        ],
      },
    })
    const inferred = json(inferredSchema, fromRows)
    expect(inferred.key).toBe('id')
    expect(inferred.columns.find((column) => column.id === 'mrr')?.type).toBe('currency')
    expect(inferred.columns.find((column) => column.id === 'plan')?.type).toBe('enum')
    expect(inferred.issues[0]).toContain('tags')
    const fromCsv = await client.callTool({
      name: 'tally_infer_schema',
      arguments: { csv: 'id,renewal\n1,2026-01-05\n2,2026-02-10\n' },
    })
    expect(json(inferredSchema, fromCsv).columns[1]?.type).toBe('date')
  })
})
