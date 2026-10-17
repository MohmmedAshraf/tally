import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import {
  AGGREGATES,
  OPERATORS,
  OPERATOR_ARITY,
  builtinTypes,
  condition,
  createSchema,
  execute,
  groupValueOf,
  parseQuery,
  printFilter,
  printQuery,
  type ColumnType,
  type Filter,
  type GroupGranularity,
  type Operator,
  type Schema,
} from 'tally-core'
import { JSON_SCHEMA_NAMES, toJsonSchema } from 'tally-protocol'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const docs = fileURLToPath(new URL('../', import.meta.url))
const snippets = `${docs}snippets/code/`
const repoUrl = 'https://github.com/MohmmedAshraf/tally/blob/main/'

interface PackageEntry {
  readonly name: string
  readonly directory: string
}

const packages: readonly PackageEntry[] = [
  { name: 'tally-core', directory: 'packages/core' },
  { name: 'tally-react', directory: 'packages/react' },
  { name: 'tally-vue', directory: 'packages/vue' },
  { name: 'tally-svelte', directory: 'packages/svelte' },
  { name: 'tally-solid', directory: 'packages/solid' },
  { name: 'tally-protocol', directory: 'packages/protocol' },
  { name: 'tally-server', directory: 'packages/server' },
  { name: 'tally/laravel', directory: 'packages/php' },
  { name: 'tally-adapters', directory: 'packages/adapters' },
  { name: 'tally-ai', directory: 'packages/ai' },
  { name: 'tally-mcp-server', directory: 'packages/mcp' },
]

interface Section {
  readonly heading: string | undefined
  readonly lines: readonly string[]
}

interface Readme {
  readonly path: string
  readonly title: string
  readonly paragraph: string
  readonly sections: readonly Section[]
}

function isFence(line: string): boolean {
  return /^\s*(```|~~~)/.test(line)
}

function mapProse(markdown: string, transform: (text: string) => string): string {
  let fenced = false
  return markdown
    .split('\n')
    .map((line) => {
      if (isFence(line)) {
        fenced = !fenced
        return line
      }
      if (fenced) return line
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, index) => (index % 2 === 1 ? part : transform(part)))
        .join('')
    })
    .join('\n')
}

function rewriteLink(target: string, readme: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) return target
  const [path = '', hash] = target.split('#')
  const resolved = posix.normalize(posix.join(posix.dirname(readme), path))
  return hash === undefined ? `${repoUrl}${resolved}` : `${repoUrl}${resolved}#${hash}`
}

function escapeMdx(text: string): string {
  return text.replace(/[<>{}]/g, (char) => `\\${char}`)
}

function toMdx(markdown: string, readme: string): string {
  return mapProse(markdown, (text) =>
    text
      .split(/(\[[^\]]*\]\([^)\s]+\))/)
      .map((part, index) => {
        if (index % 2 === 0) return escapeMdx(part)
        const match = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(part)
        if (match?.[1] === undefined || match[2] === undefined) return escapeMdx(part)
        return `[${escapeMdx(match[1])}](${rewriteLink(match[2], readme)})`
      })
      .join(''),
  )
}

function splitSections(lines: readonly string[]): readonly Section[] {
  const sections: Section[] = []
  let current: { heading: string | undefined; lines: string[] } = { heading: undefined, lines: [] }
  let fenced = false
  for (const line of lines) {
    if (isFence(line)) fenced = !fenced
    const match = fenced ? null : /^#{2,6}\s+(.+)$/.exec(line)
    if (match?.[1] !== undefined) {
      sections.push(current)
      current = { heading: match[1].trim(), lines: [] }
      continue
    }
    current.lines.push(line)
  }
  sections.push(current)
  return sections
}

function trimBlank(text: string): string {
  return text.replace(/^\s*\n/, '').replace(/\n\s*$/, '')
}

async function loadReadme(path: string): Promise<Readme> {
  const source = (await readFile(`${repo}${path}`, 'utf8')).replace(/\r\n/g, '\n')
  const lines = source.split('\n').filter((line) => line.trim() !== 'Not published yet.')
  const titleIndex = lines.findIndex((line) => line.startsWith('# '))
  if (titleIndex === -1) throw new Error(`${path} has no title`)
  const rest = lines.slice(titleIndex + 1)
  const start = rest.findIndex((line) => line.trim() !== '')
  const end = rest.findIndex((line, index) => index > start && line.trim() === '')
  const paragraph = rest.slice(start, end === -1 ? undefined : end)
  if (start === -1 || paragraph.some((line) => line.startsWith('#'))) {
    throw new Error(`${path} has no description paragraph`)
  }
  return {
    path,
    title: (lines[titleIndex] ?? '').slice(2).trim(),
    paragraph: paragraph.join(' '),
    sections: splitSections(rest.slice(end === -1 ? rest.length : end)),
  }
}

function sectionText(readme: Readme, heading: string): string {
  const section = readme.sections.find((entry) => entry.heading === heading)
  if (section === undefined) throw new Error(`${readme.path} has no "${heading}" section`)
  return trimBlank(section.lines.join('\n'))
}

function firstCodeBlock(text: string): string {
  const match = /```([^\n]*)\n([\s\S]*?)\n```/.exec(text)
  if (match?.[2] === undefined) throw new Error('Missing code block')
  return `\`\`\`${match[1] ?? ''}\n${match[2]}\n\`\`\``
}

function page(fields: Readonly<Record<string, string>>, body: string): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`
}

function code(text: string): string {
  return `\`${text}\``
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n')
}

const querySchema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'owner', type: 'person' },
    {
      id: 'plan',
      type: 'enum',
      options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }],
    },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'growth', type: 'percent' },
    { id: 'renewal', type: 'date' },
    { id: 'active', type: 'bool' },
  ],
})

const sampleColumn: Readonly<Record<ColumnType['kind'], string>> = {
  text: 'account',
  enum: 'plan',
  number: 'mrr',
  date: 'renewal',
  boolean: 'active',
}

function sampleValue(kind: ColumnType['kind'], op: Operator): unknown {
  const arity = OPERATOR_ARITY[op]
  if (arity === 'none') return undefined
  if (arity === 'relative') return { direction: 'last', amount: 30, unit: 'day' }
  const values: Readonly<Record<ColumnType['kind'], readonly unknown[]>> = {
    text: ['acme', 'globex'],
    enum: ['pro', 'team'],
    number: [1000, 5000],
    date: ['2026-01-01', '2026-03-31'],
    boolean: [true, false],
  }
  return arity === 'one' ? values[kind][0] : values[kind]
}

function operatorsOf(filter: Filter | undefined): readonly string[] {
  if (filter === undefined) return []
  switch (filter.type) {
    case 'condition':
      return [filter.op]
    case 'search':
      return ['search']
    case 'flag':
      return ['flag']
    case 'not':
      return ['not', ...operatorsOf(filter.filter)]
    case 'and':
    case 'or':
      return [filter.type, ...filter.filters.flatMap(operatorsOf)]
  }
}

function parsed(input: string, schema: Schema): readonly string[] {
  const result = parseQuery(input, schema)
  if (result.errors.length > 0) {
    throw new Error(`"${input}" does not parse: ${result.errors.map((e) => e.message).join(', ')}`)
  }
  const ops = [...new Set(operatorsOf(result.query.filter))]
  const directives = [
    ...(result.query.sort.length > 0 ? ['sort'] : []),
    ...(result.query.group === undefined ? [] : ['group']),
  ]
  return [
    code(input),
    code(printQuery(result.query, schema)),
    [...ops, ...directives].map(code).join(', '),
  ]
}

function examples(inputs: readonly string[]): string {
  return table(
    ['Input', 'Canonical form', 'Parsed to'],
    inputs.map((input) => parsed(input, querySchema)),
  )
}

function operatorTable(): string {
  return table(
    ['Operator', 'Arity', 'Printed as'],
    OPERATORS.map((op) => {
      const type = builtinTypes.find((entry) => entry.operators.includes(op))
      if (type === undefined) throw new Error(`No built-in type supports ${op}`)
      const filter = condition(sampleColumn[type.kind], op, sampleValue(type.kind, op))
      return [code(op), OPERATOR_ARITY[op], code(printFilter(filter, querySchema))]
    }),
  )
}

function typeTable(): string {
  return table(
    ['Type', 'Kind', 'Operators', 'Groupable', 'Searchable', 'Aggregates', 'Facet'],
    builtinTypes.map((type) => [
      code(type.name),
      type.kind,
      type.operators.map(code).join(' '),
      type.groupable ? 'yes' : 'no',
      type.searchable ? 'yes' : 'no',
      type.aggregates.map(code).join(' '),
      type.facet,
    ]),
  )
}

function granularities(node: unknown): readonly GroupGranularity[] | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = granularities(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  const entries: readonly (readonly [string, unknown])[] = Object.entries(node)
  for (const [key, value] of entries) {
    if (key === 'granularity' && typeof value === 'object' && value !== null && 'enum' in value) {
      const options: unknown = value.enum
      if (Array.isArray(options)) {
        return options.filter((option): option is GroupGranularity => typeof option === 'string')
      }
    }
    const found = granularities(value)
    if (found !== undefined) return found
  }
  return undefined
}

function granularityTable(): string {
  const sample = '2026-05-14'
  const column = querySchema.column('renewal')
  if (column === undefined) throw new Error('Missing renewal column')
  const fallback = execute(
    [{ id: 1, renewal: sample }],
    { sort: [], group: { column: 'renewal' } },
    querySchema,
  ).groups?.[0]?.key
  const options = granularities(toJsonSchema('query-request'))
  if (options === undefined) throw new Error('query-request has no granularity enum')
  return table(
    ['Granularity', `Bucket of ${code(sample)}`, 'Default'],
    options.map((granularity) => {
      const bucket = String(groupValueOf({ renewal: sample }, column, querySchema, granularity))
      return [code(granularity), code(bucket), bucket === fallback ? 'yes' : '']
    }),
  )
}

function queryLanguagePage(core: Readme): string {
  const body = `
${toMdx(sectionText(core, 'Query language'), core.path)}

## Example schema

The examples in the tables below are parsed against this schema when the page is generated.

\`\`\`json
[
${querySchema.columns
  .map(({ id, label, type, options }) => `  ${JSON.stringify({ id, label, type, options })}`)
  .join(',\n')}
]
\`\`\`

## Column types

Every column type declares the operators it accepts. A condition with an operator the type does not list is a parse error.

${typeTable()}

## Operators

${operatorTable()}

## Conditions

A condition is a column followed by an operator and a value. Column names resolve by id, label or alias.

${examples([
  'plan is pro',
  'plan = pro',
  'plan is not free',
  'plan != free',
  'active is yes',
  'mrr > 2k',
  'mrr greater than 2k',
  'mrr at least 1.5m',
  'mrr >= $5,000',
  'mrr under 500',
  'mrr at most 1k',
  'growth > 12%',
  'renewal after 2026-01-15',
  'renewal before 2026',
])}

## Text

${examples([
  'account contains acme',
  'account has acme',
  'account does not contain test',
  'account starts with ac',
  'account ends with corp',
  'account acme',
])}

## Lists

\`in\` matches any of the listed values. Values separated by \`or\` after \`is\` collapse into one \`in\` condition.

${examples([
  'plan is pro or team',
  'plan in (pro, team)',
  'plan one of pro or team',
  'plan not in (free)',
  'plan is not pro or team',
])}

## Ranges

\`between\` is inclusive and orders its bounds. On dates, a year or a month expands to its first and last day.

${examples([
  'mrr between 1k and 5k',
  'mrr between 5k and 1k',
  'mrr 1k..5k',
  'mrr 1k to 5k',
  'renewal is 2026-01',
  'renewal is 2026',
  'renewal 2026-01 to 2026-03',
])}

## Empty values

${examples([
  'owner is empty',
  'owner is blank',
  'owner is missing',
  'owner is not empty',
  'owner is set',
])}

## Relative dates

Relative ranges resolve against the executor's \`today\`. The amount must be a whole number of periods.

${examples([
  'renewal last 30 days',
  'renewal past 3 mo',
  'renewal next 2 weeks',
  'renewal upcoming quarter',
  'renewal this quarter',
  'renewal this year',
  'renewal today',
  'renewal yesterday',
  'renewal tomorrow',
  'renewal within last 7 days',
  'renewal in next month',
  'renewal not in last 90 days',
])}

## Search and flags

Bare words outside a condition search every searchable column. \`is:name\` is a flag; the data source decides what each flag means.

${examples(['acme', '"acme corp"', 'acme corp, plan is pro', 'is:overdue', 'not is:overdue'])}

## Logic

Conditions joined by \`and\`, \`&&\` or a comma must all match. \`or\` matches either side, \`not\` negates, and parentheses group.

${examples([
  'plan is pro and mrr > 1k',
  'plan is pro, mrr > 1k',
  'plan is pro && mrr > 1k',
  'plan is free or mrr < 100',
  'not (plan is free or mrr < 100)',
])}

## Sort and group

\`sort by\` without a direction sorts numbers and dates descending and everything else ascending.

${examples([
  'sort by mrr',
  'sort by account',
  'sort by mrr asc',
  'order by renewal oldest first',
  'group by plan',
  'plan is pro, sort by mrr desc, group by owner',
])}

## Grouping granularity

Date columns group into buckets. The query text groups by the column; the view sets the granularity.

${granularityTable()}

## Aggregates

${AGGREGATES.map(code).join(', ')}
`
  return page(
    {
      title: 'Query language reference',
      sidebarTitle: 'Query language',
      description:
        'Every column type, operator and directive the parser accepts, with examples parsed by tally-core.',
      icon: 'square-terminal',
    },
    body,
  )
}

function jsonSchemaPage(protocol: Readme): string {
  const accordions = JSON_SCHEMA_NAMES.map(
    (name) => `<Accordion title="${name}.json">

\`\`\`json
${JSON.stringify(toJsonSchema(name), null, 2)}
\`\`\`

</Accordion>`,
  ).join('\n\n')
  return page(
    {
      title: 'JSON Schema',
      description: 'The JSON Schema documents generated from the tally-protocol wire schemas.',
      icon: 'braces',
    },
    `${toMdx(sectionText(protocol, 'JSON Schema'), protocol.path)}

<AccordionGroup>

${accordions}

</AccordionGroup>`,
  )
}

function packagesPage(readmes: readonly Readme[]): string {
  const sections = readmes.map((readme, index) => {
    const entry = packages[index]
    if (entry === undefined) throw new Error(`Missing package for ${readme.path}`)
    return `## ${entry.name}

${toMdx(readme.paragraph, readme.path)}

${firstCodeBlock(sectionText(readme, 'Install'))}

[README](${repoUrl}${entry.directory}/README.md)`
  })
  return page(
    {
      title: 'Packages',
      description: 'Every Tally package, what it does and how to install it.',
      icon: 'package',
    },
    sections.join('\n\n'),
  )
}

async function filesUnder(directory: string, accept: (path: string) => boolean): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.replace(/\/+/g, '/'))
    .filter((path) => !path.includes('/node_modules/') && accept(path))
    .toSorted()
}

const snippetMarker =
  /^([ \t]*)\{\/\* snippet: (\S+) \*\/\}\n(?:[ \t]*\n)*([ \t]*)(`{3,})([^\n]*)\n(?:[\s\S]*?\n)??[ \t]*\4[ \t]*$/gm

async function inlineSnippets(source: string, used: Set<string>): Promise<string> {
  const markers = source.match(/\{\/\* snippet: /g)?.length ?? 0
  const matches = [...source.matchAll(snippetMarker)]
  if (matches.length !== markers)
    throw new Error('A snippet marker is not followed by a code block')
  const bodies = await Promise.all(
    matches.map((match) => {
      const file = `${snippets}${match[2] ?? ''}`
      used.add(file)
      return readFile(file, 'utf8')
    }),
  )
  let output = source
  for (const [index, match] of matches.entries().toArray().toReversed()) {
    const [whole, markerIndent = '', path = '', fenceIndent = '', fence = '', meta = ''] = match
    const body = (bodies[index] ?? '')
      .replace(/\n+$/, '')
      .split('\n')
      .map((line) => (line === '' ? line : `${fenceIndent}${line}`))
      .join('\n')
    const replacement = `${markerIndent}{/* snippet: ${path} */}\n\n${fenceIndent}${fence}${meta}\n${body}\n${fenceIndent}${fence}`
    output = output.slice(0, match.index) + replacement + output.slice(match.index + whole.length)
  }
  return output
}

async function writeFormatted(path: string, content: string): Promise<boolean> {
  const options = await resolveConfig(path)
  const formatted = await format(content, { ...options, filepath: path })
  const current = await readFile(path, 'utf8').catch(() => undefined)
  if (current === formatted) return false
  await writeFile(path, formatted)
  return true
}

async function main(): Promise<void> {
  const readmes = await Promise.all(
    packages.map((entry) => loadReadme(`${entry.directory}/README.md`)),
  )
  const core = readmes[0]
  const protocol = readmes[5]
  if (core === undefined || protocol === undefined) throw new Error('Missing core or protocol')
  const generated: readonly (readonly [string, string])[] = [
    [`${docs}reference/query-language.mdx`, queryLanguagePage(core)],
    [`${docs}reference/json-schema.mdx`, jsonSchemaPage(protocol)],
    [`${docs}reference/packages.mdx`, packagesPage(readmes)],
  ]
  const used = new Set<string>()
  const pages = await filesUnder(docs, (file) => extname(file) === '.mdx')
  const authored = pages.filter((path) => !generated.some(([target]) => target === path))
  const outputs: readonly (readonly [string, string])[] = [
    ...generated,
    ...(await Promise.all(
      authored.map(
        async (path) => [path, await inlineSnippets(await readFile(path, 'utf8'), used)] as const,
      ),
    )),
  ]
  const written = await Promise.all(outputs.map(([path, content]) => writeFormatted(path, content)))
  const changed = outputs.filter((_, index) => written[index] === true).map(([path]) => path)
  const orphans = (await filesUnder(snippets, () => true)).filter((path) => !used.has(path))
  if (orphans.length > 0) {
    throw new Error(
      `Snippets used by no page: ${orphans.map((path) => relative(docs, path)).join(', ')}`,
    )
  }
  const summary =
    changed.length === 0 ? 'up to date' : changed.map((path) => relative(docs, path)).join(', ')
  process.stdout.write(`Generated docs: ${summary}\n`)
}

await main()
