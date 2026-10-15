import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server'
import { JSON_SCHEMA_NAMES, toJsonSchema } from 'tally-protocol'
import * as z from 'zod'
import { findExtensionPoints, renderExtensionPoints } from './extension-points.ts'
import { GUIDE_TITLES, searchSections, sectionsOf, type Guides } from './guides.ts'
import { inferFromCsv, inferFromRows, parseQueryText, validateRequest } from './tools.ts'

export interface TallyServerOptions {
  readonly guides: Guides
  readonly version?: string | undefined
}

const columnsInput = z
  .array(z.looseObject({ id: z.string(), type: z.string().optional() }))
  .describe('Column definitions as passed to createSchema: id, type, label, options and friends')

const pointOutput = z.object({
  id: z.string(),
  title: z.string(),
  package: z.string(),
  api: z.string(),
  how: z.string(),
  example: z.string(),
  guide: z.string(),
})

function single(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value
}

function text(value: unknown): {
  readonly content: { readonly type: 'text'; readonly text: string }[]
} {
  return {
    content: [
      { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
    ],
  }
}

export function createTallyServer(options: TallyServerOptions): McpServer {
  const guides: Guides = { ...options.guides, extend: renderExtensionPoints() }
  const sections = sectionsOf(guides)
  const server = new McpServer({ name: 'tally', version: options.version ?? '0.0.0' })

  server.registerResource(
    'guide',
    new ResourceTemplate('tally://guide/{name}', {
      list: () => ({
        resources: Object.keys(guides).map((name) => ({
          uri: `tally://guide/${name}`,
          name,
          title: GUIDE_TITLES[name] ?? name,
          mimeType: 'text/markdown',
        })),
      }),
    }),
    {
      description: 'Tally package guides. Read overview first, then extend.',
      mimeType: 'text/markdown',
    },
    (uri, variables) => {
      const name = single(variables['name'] ?? '')
      const markdown = guides[name]
      if (markdown === undefined) throw new Error(`No guide named ${name}`)
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: markdown }] }
    },
  )

  server.registerResource(
    'json-schema',
    new ResourceTemplate('tally://schema/{name}', {
      list: () => ({
        resources: JSON_SCHEMA_NAMES.map((name) => ({
          uri: `tally://schema/${name}`,
          name,
          mimeType: 'application/schema+json',
        })),
      }),
    }),
    {
      description: 'JSON Schema for every protocol message, for adapters in any language',
      mimeType: 'application/schema+json',
    },
    (uri, variables) => {
      const name = single(variables['name'] ?? '')
      const known = JSON_SCHEMA_NAMES.find((candidate) => candidate === name)
      if (known === undefined) throw new Error(`No schema named ${name}`)
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/schema+json',
            text: JSON.stringify(toJsonSchema(known), null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'tally_where',
    {
      title: 'Where does this change go',
      description:
        'Describe a change to a Tally grid in plain words and get the package, API and a snippet for the extension point that owns it. Call this before editing anything.',
      inputSchema: z.object({
        change: z.string().describe('What you want to change, in a sentence'),
      }),
      outputSchema: z.object({ matches: z.array(pointOutput) }),
    },
    ({ change }) => {
      const matches = findExtensionPoints(change).map(({ keywords: _keywords, ...point }) => point)
      return { ...text(matches), structuredContent: { matches } }
    },
  )

  server.registerTool(
    'tally_search',
    {
      title: 'Search the Tally guides',
      description: 'Full text search over every package guide. Returns the best matching sections.',
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
    },
    ({ query, limit }) => {
      const hits = searchSections(sections, query, limit)
      const body = hits
        .map((hit) => `## ${hit.heading} (tally://guide/${hit.guide})\n\n${hit.text}`)
        .join('\n\n---\n\n')
      return text(body === '' ? 'No section matched.' : body)
    },
  )

  server.registerTool(
    'tally_parse_query',
    {
      title: 'Parse a Tally query',
      description:
        'Parse filter text in the Tally query language against a set of columns. Returns the query AST, its canonical form and parse errors with offsets. Use it to check any query string before putting it in code, a saved view or a prompt example.',
      inputSchema: z.object({ text: z.string(), columns: columnsInput }),
    },
    ({ text: query, columns }) => text(parseQueryText(query, columns)),
  )

  server.registerTool(
    'tally_validate_request',
    {
      title: 'Validate a protocol request',
      description:
        'Validate a query or mutation request body against the wire schema and a set of columns, exactly as tally-server does before running SQL. Returns every problem by path.',
      inputSchema: z.object({
        kind: z.enum(['query', 'mutation']),
        request: z.unknown(),
        columns: columnsInput,
        key: z.string().optional().describe('Key field name when mutations are validated'),
      }),
      outputSchema: z.object({ valid: z.boolean(), issues: z.array(z.string()) }),
    },
    ({ kind, request, columns, key }) => {
      const result = validateRequest(kind, request, columns, key)
      return { ...text(result), structuredContent: result }
    },
  )

  server.registerTool(
    'tally_infer_schema',
    {
      title: 'Infer a schema from data',
      description:
        'Detect column types, enum options and the key field from sample rows or CSV text, ready for createSchema. Pass rows as JSON objects or csv as text.',
      inputSchema: z.object({
        rows: z.array(z.record(z.string(), z.unknown())).optional(),
        csv: z.string().optional(),
        key: z.string().optional(),
      }),
    },
    ({ rows, csv, key }) => {
      if (csv !== undefined) return text(inferFromCsv(csv, key))
      if (rows !== undefined && rows.length > 0) return text(inferFromRows(rows, key))
      throw new Error('Pass rows or csv')
    },
  )

  return server
}
