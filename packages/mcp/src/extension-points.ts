import { tokenize } from './guides.ts'

export interface ExtensionPoint {
  readonly id: string
  readonly title: string
  readonly package: string
  readonly api: string
  readonly how: string
  readonly example: string
  readonly guide: string
  readonly keywords: readonly string[]
}

export const EXTENSION_POINTS: readonly ExtensionPoint[] = [
  {
    id: 'renderer',
    title: 'Change how a column type or kind is drawn',
    package: 'tally-react',
    api: '<Tally renderers={{ [typeName | kind]: Renderer }}>',
    how: 'Pass a renderer keyed by the column type name first, then its kind. It receives value, text, row, column, type and format. Keep the data and the query untouched; only the cell changes.',
    example: `const renderers = {
  health: ({ value, text }) => <Ring value={value} label={text} />,
}
<Tally grid={grid} renderers={renderers} />`,
    guide: 'react',
    keywords: [
      'renderer',
      'render',
      'cell',
      'ring',
      'gauge',
      'progress',
      'badge',
      'pill',
      'avatar',
      'icon',
      'custom',
      'display',
      'draw',
      'component',
    ],
  },
  {
    id: 'editor',
    title: 'Change how a cell is edited',
    package: 'tally-react',
    api: '<Tally editors={{ [typeName | kind]: Editor }}>',
    how: 'Pass an editor keyed by type name or kind. It receives value, column, commit(value, move?) and cancel(). Call commit to write through grid.setCells with undo.',
    example: `const editors = {
  enum: ({ value, column, commit, cancel }) => (
    <MySelect value={value} options={column.options} onChange={commit} onEscape={cancel} />
  ),
}
<Tally grid={grid} editors={editors} />`,
    guide: 'react',
    keywords: ['editor', 'edit', 'input', 'select', 'picker', 'datepicker', 'inline', 'commit'],
  },
  {
    id: 'column-type',
    title: 'Add a new column type',
    package: 'tally-core',
    api: 'createTypeRegistry(...types) and createSchema({ columns, registry })',
    how: 'Implement ColumnType: name, kind, parse, format, compare, is, operators, facet, card, optional detect and jsonSchema. Register it and pass the registry to createSchema. Servers receive the type name through the schema route, so pass the same registry to connectHttpSource on the client.',
    example: `const rating: ColumnType = { ...builtinTypes.int, name: 'rating', format: (value) => '★'.repeat(value) }
const registry = createTypeRegistry(...builtinTypes.all, rating)
const schema = createSchema({ columns, registry })`,
    guide: 'core',
    keywords: [
      'type',
      'column type',
      'registry',
      'kind',
      'rating',
      'money',
      'duration',
      'new type',
    ],
  },
  {
    id: 'column-options',
    title:
      'Shape a column: label, width, pin, aggregate, avatar, subtitle, sparkline, relative, card role',
    package: 'tally-core',
    api: 'createSchema({ columns: [{ id, type, label, width, flex, pin, aggregate, avatar, subtitle, sparkline, relative, card, hidden, editable, filterable, sortable, groupable, options, format }] })',
    how: 'Column options drive the default renderers and the menus. Nothing else is needed for an initials tile, a secondary line, a sparkline before a number or a relative date line.',
    example: `{ id: 'account', label: 'Account', avatar: true, subtitle: 'domain', pin: 'left', flex: 1 }
{ id: 'mrr', type: 'currency', aggregate: 'sum', sparkline: 'history' }
{ id: 'renewal', type: 'date', relative: true }`,
    guide: 'core',
    keywords: [
      'column',
      'schema',
      'label',
      'width',
      'pin',
      'sticky',
      'aggregate',
      'sum',
      'avatar',
      'subtitle',
      'sparkline',
      'relative',
      'hidden',
      'readonly',
      'card',
    ],
  },
  {
    id: 'theme',
    title: 'Theme, colors, fonts, density, radius',
    package: 'tally-react',
    api: 'CSS custom properties on .tally, data attributes, <Tally theme dir>',
    how: 'Override --tally-* tokens on .tally or any ancestor. Dark mode follows color-scheme or theme="dark". Target states through data attributes such as [data-selected] or [data-sign="down"]. Density is a view property.',
    example: `.tally {
  --tally-accent: oklch(0.6 0.18 30);
  --tally-font: 'Inter', sans-serif;
  --tally-row-height: 40px;
}`,
    guide: 'react',
    keywords: [
      'theme',
      'dark',
      'light',
      'color',
      'colour',
      'brand',
      'font',
      'css',
      'style',
      'styling',
      'token',
      'radius',
      'density',
      'tailwind',
      'compact',
    ],
  },
  {
    id: 'labels',
    title: 'Translate or reword UI text',
    package: 'tally-react',
    api: '<Tally labels={Partial<TallyLabels>}>',
    how: 'Every string in the UI is a key of TallyLabels. Pass the ones to change; the rest keep defaultLabels.',
    example: `<Tally grid={grid} labels={{ filterPlaceholder: 'Filtern…', rows: (n) => \`\${n} Zeilen\` }} />`,
    guide: 'react',
    keywords: [
      'label',
      'i18n',
      'translate',
      'locale',
      'language',
      'copy',
      'text',
      'wording',
      'string',
    ],
  },
  {
    id: 'intents',
    title: 'Hook keyboard and mouse actions, command palette, inspector',
    package: 'tally-react',
    api: '<Tally onIntent={(intent: GridIntent) => boolean | undefined}>',
    how: 'Every input becomes a GridIntent first. Return true to consume it. Cmd/Ctrl+K emits commandPalette, Space emits inspect, so a host binds its own palette or side panel without forking the grid.',
    example: `<Tally
  grid={grid}
  onIntent={(intent) => {
    if (intent.type === 'commandPalette') { openPalette(); return true }
    return undefined
  }}
/>`,
    guide: 'react',
    keywords: [
      'intent',
      'keyboard',
      'shortcut',
      'hotkey',
      'palette',
      'inspect',
      'click',
      'event',
      'handler',
      'block',
    ],
  },
  {
    id: 'toolbar',
    title: 'Replace or extend the toolbar',
    package: 'tally-react',
    api: '<Tally toolbar toolbarStart>, exported parts Toolbar, FilterBar, Chip, DisplayMenu, Pager, HeaderMenu, RulesPopover, RowMenu',
    how: 'Children render at the end of the default toolbar, toolbarStart before the filter bar. Pass toolbar={false} and compose the exported parts with useGridContext for a different arrangement.',
    example: `<Tally grid={grid} toolbarStart={<ViewTabs />}>
  <ExportButton />
</Tally>`,
    guide: 'react',
    keywords: [
      'toolbar',
      'header',
      'button',
      'tabs',
      'filter bar',
      'pager',
      'compose',
      'layout',
      'slot',
    ],
  },
  {
    id: 'sql-backend',
    title: 'Serve the grid from a SQL database',
    package: 'tally-server',
    api: 'createKyselyAdapter({ db, table, schema, dialect, columns, flags }) and createTallyHandler({ source, schema, basePath })',
    how: 'The adapter compiles validated protocol requests to SQL and passes the conformance suite on SQLite, Postgres and MySQL. Mount the Fetch handler on any framework. For SQL Server or another engine implement SqlDialect. For Laravel use tally/laravel.',
    example: `const accounts = createKyselyAdapter({ db, table: 'accounts', schema, dialect: postgresDialect })
const handler = createTallyHandler({ source: accounts, schema, basePath: '/api/accounts' })
app.all('/api/accounts/*', (c) => handler(c.req.raw))`,
    guide: 'server',
    keywords: [
      'server',
      'backend',
      'sql',
      'postgres',
      'postgresql',
      'sqlite',
      'mysql',
      'database',
      'kysely',
      'prisma',
      'drizzle',
      'api',
      'endpoint',
      'route',
      'hono',
      'express',
      'next',
    ],
  },
  {
    id: 'laravel-backend',
    title: 'Serve the grid from a Laravel app',
    package: 'tally/laravel',
    api: 'class AccountsGrid extends Grid { query(); columns() } and Route::tally(uri, AccountsGrid::class)',
    how: 'Extend Grid with the Eloquent query and the column definitions, then register it with the Route::tally macro. The adapter validates every request against the protocol JSON Schema, compiles it with the query builder and passes the conformance suite on SQLite, Postgres and MySQL. Override columnMap(), flags(), mutable(), maxLimit() or dialect() on the grid.',
    example: `final class AccountsGrid extends Grid
{
    public function query(): Builder
    {
        return Account::query()->whereBelongsTo(auth()->user()->team);
    }

    public function columns(): array
    {
        return [
            ['id' => 'account', 'label' => 'Account'],
            ['id' => 'mrr', 'type' => 'currency', 'aggregate' => 'sum'],
        ];
    }
}

Route::tally('/api/accounts', AccountsGrid::class);`,
    guide: 'php',
    keywords: [
      'laravel',
      'php',
      'eloquent',
      'composer',
      'artisan',
      'blade',
      'inertia',
      'livewire',
      'query builder',
      'model',
      'controller',
      'route',
      'backend',
      'mysql',
      'mariadb',
      'pgsql',
    ],
  },
  {
    id: 'http-source',
    title: 'Connect the grid to an HTTP API',
    package: 'tally-adapters',
    api: 'connectHttpSource({ url, headers, fetch, registry })',
    how: 'Any server that answers GET /schema, POST /query, PATCH /rows and GET /events speaks the protocol. One call fetches the schema and returns a DataSource with live patches over SSE. For an API that does not speak the protocol, implement DataSource from tally-core directly: capabilities, query, optional mutate and subscribe.',
    example: `const { schema, source } = await connectHttpSource({
  url: '/api/accounts',
  headers: () => ({ authorization: \`Bearer \${token()}\` }),
})
const grid = useGrid({ schema, source })`,
    guide: 'adapters',
    keywords: [
      'http',
      'fetch',
      'rest',
      'api',
      'remote',
      'client',
      'source',
      'datasource',
      'connect',
      'auth',
      'token',
      'headers',
    ],
  },
  {
    id: 'supabase',
    title: 'Run the grid straight against Supabase',
    package: 'tally-adapters',
    api: "createSupabaseSource({ client, table, schema, realtime }) from 'tally-adapters/supabase'",
    how: 'Filters, search, sorts and pages compile to PostgREST, edits go through the table API, Realtime delivers patches. Groups, aggregates and facets are computed from the loaded page.',
    example: `const source = createSupabaseSource({ client: createClient(url, key), table: 'accounts', schema })`,
    guide: 'adapters',
    keywords: ['supabase', 'postgrest', 'realtime', 'serverless', 'no server'],
  },
  {
    id: 'cache',
    title: 'Cache and dedupe requests, or run local-first',
    package: 'tally-adapters',
    api: "createQuerySource({ client, source, queryKey }) from 'tally-adapters/query', createCollectionSource(collection, schema) from 'tally-adapters/db'",
    how: 'Wrap any source in TanStack Query for caching and devtools, or run over a TanStack DB collection so filters execute locally and edits go through the collection persistence handlers.',
    example: `const source = createQuerySource({ client: queryClient, source: remote, queryKey: ['accounts'], staleTime: 30_000 })`,
    guide: 'adapters',
    keywords: [
      'cache',
      'caching',
      'dedupe',
      'tanstack',
      'query',
      'react query',
      'collection',
      'local first',
      'offline',
      'optimistic',
      'sync',
    ],
  },
  {
    id: 'live',
    title: 'Push live updates into the grid',
    package: 'tally-core',
    api: 'DataSource.subscribe(onPatch) delivering RowPatch { upserts, deletes }; ArraySource.patch; tally-server GET /events',
    how: 'A source with live capability publishes patches; the grid merges them, marks changed cells and re-ranks rows by the view sort. The HTTP handler relays patches over server sent events and the HTTP source reconnects on its own.',
    example: `source.patch({ upserts: [{ id: 7, mrr: 1200 }] })
source.patch({ deletes: [9] })`,
    guide: 'core',
    keywords: [
      'live',
      'realtime',
      'real-time',
      'stream',
      'websocket',
      'sse',
      'push',
      'patch',
      'subscribe',
      'update',
      'polling',
    ],
  },
  {
    id: 'ask',
    title: 'Answer natural language with a validated query',
    package: 'tally-ai',
    api: 'ask(question, { model, schema }) and createAskHandler({ model }) for the ai prop',
    how: 'The model answers in Tally query text which is parsed against the schema with one repair round; only a query that parses is returned. In the browser call the provider through a same-origin proxy that adds the API key.',
    example: `const ai = { ask: createAskHandler({ model: anthropic('claude-sonnet-5-5') }) }
<Tally grid={grid} ai={ai} />`,
    guide: 'ai',
    keywords: [
      'ask',
      'natural language',
      'nl',
      'llm',
      'prompt',
      'chat',
      'ai',
      'model',
      'question',
      'search bar',
      'anthropic',
      'openai',
    ],
  },
  {
    id: 'ai-column',
    title: 'Add a column the model fills per row',
    package: 'tally-ai',
    api: 'withAiColumns(source, schema, [{ column, model, instruction, inputs }]) and designColumn(prompt, { model, schema })',
    how: 'Declare the column ai: true, non filterable, non sortable, non groupable. Values stream in as live patches and are cached per row. designColumn turns a prompt into a column definition plus the fill instruction; wire it to the addColumn handler of the ai prop.',
    example: `const { column, instruction } = await designColumn('Churn risk, low or high', { model, schema })
const extended = schema.extend([column], 1)
const source = withAiColumns(base, extended, [{ column: column.id, model, instruction }])`,
    guide: 'ai',
    keywords: [
      'ai column',
      'computed',
      'classify',
      'sentiment',
      'summarize',
      'enrich',
      'generate',
      'fill',
      'design column',
      'model column',
    ],
  },
  {
    id: 'framework-binding',
    title: 'Use the grid engine from Vue, Svelte or Solid',
    package: 'tally-vue, tally-svelte, tally-solid',
    api: 'useGrid(options) with useGridState / gridState / createGridState, plus view, rows and selection helpers and a context pair per framework',
    how: 'The engine is tally-core and renders nothing. Each binding keeps one Grid per component (recreated when schema, source or format change, keeping the view), subscribes to its stores with the framework reactivity primitive and unsubscribes on unmount. Build the markup yourself; the full component only exists for React.',
    example: `const grid = useGrid({ schema, source })
const state = useGridState(grid)
const view = useView(grid)
grid.view.toggleSort('mrr')`,
    guide: 'vue',
    keywords: [
      'vue',
      'nuxt',
      'svelte',
      'sveltekit',
      'solid',
      'solidstart',
      'composable',
      'rune',
      'signal',
      'store',
      'headless',
      'binding',
      'framework',
      'angular',
    ],
  },
  {
    id: 'views',
    title: 'Saved views, URL state, formatting rules, density',
    package: 'tally-core',
    api: 'grid.view (ViewStore), viewToUrlString, viewFromUrlString, reconcileView, View.rules',
    how: 'A View holds filter, sort, group, columns, density, footer and rules. Serialize it for a URL or a database, restore it with reconcileView so renamed columns drop out cleanly. Conditional formatting lives in View.rules.',
    example: `const search = viewToUrlString(grid.view.get(), schema)
grid.view.set(reconcileView(viewFromUrlString(search, schema), schema))`,
    guide: 'core',
    keywords: [
      'view',
      'saved',
      'url',
      'share',
      'bookmark',
      'persist',
      'state',
      'rule',
      'conditional',
      'formatting',
      'highlight',
      'density',
      'columns order',
    ],
  },
  {
    id: 'cards',
    title: 'Phone layout and the detail sheet',
    package: 'tally-react',
    api: '<Tally layout cardsBelow detail>, column card roles title | badge | metric | meta | hidden',
    how: 'Below cardsBelow pixels rows render as cards grouped by card role. Tapping a card opens a sheet with every visible field. Pass detail={false} to disable it or a function to render the sheet body.',
    example: `<Tally grid={grid} layout="auto" cardsBelow={620} detail={({ item, close }) => <AccountPanel row={item.row} onClose={close} />} />`,
    guide: 'react',
    keywords: [
      'mobile',
      'phone',
      'card',
      'cards',
      'responsive',
      'narrow',
      'detail',
      'sheet',
      'drawer',
      'tap',
      'panel',
    ],
  },
  {
    id: 'csv',
    title: 'Import or export CSV',
    package: 'tally-core',
    api: "importCsv(text, options) from 'tally-core/import', toCsv(rows, schema), toTsv",
    how: 'Import detects column types and enum options from the samples and reports issues per cell. Export formats with the schema so enum labels and dates come out as displayed.',
    example: `const { columns, rows, issues } = importCsv(text, { keyField: 'id' })
const schema = createSchema({ columns: columns.map((entry) => entry.column), key: 'id' })`,
    guide: 'core',
    keywords: [
      'csv',
      'tsv',
      'import',
      'export',
      'download',
      'upload',
      'file',
      'excel',
      'spreadsheet',
      'detect',
    ],
  },
  {
    id: 'validation',
    title: 'Validate requests on your own server',
    package: 'tally-protocol',
    api: 'validateQueryRequest(input, schema), validateMutationRequest, queryIssues, mutationIssues, schemas/*.json',
    how: 'Parse the wire shape then check columns, operators, arities and aggregates against the schema. Throws TallyError invalid_query with one detail per problem. JSON Schema files serve adapters in other languages.',
    example: `const request = validateQueryRequest(await req.json(), schema)`,
    guide: 'protocol',
    keywords: [
      'validate',
      'validation',
      'protocol',
      'json schema',
      'wire',
      'request',
      'security',
      'injection',
      'zod',
    ],
  },
  {
    id: 'conformance',
    title: 'Prove a new adapter matches the reference engine',
    package: 'tally-protocol',
    api: 'runConformance((request) => adapter.query(request), { capabilities })',
    how: 'The suite replays every filter, sort, group, aggregate, facet and page case over a fixture dataset with empties in every column and diffs the result against the in-memory executor. Create the adapter with today set to CONFORMANCE_TODAY.',
    example: `const report = await runConformance((request) => adapter.query(request), { capabilities: adapter.capabilities })
expect(report.failures).toEqual([])`,
    guide: 'protocol',
    keywords: [
      'conformance',
      'test',
      'adapter',
      'new backend',
      'semantics',
      'parity',
      'fixture',
      'verify',
    ],
  },
  {
    id: 'query-language',
    title: 'Write or parse a filter in the query language',
    package: 'tally-core',
    api: 'parseQuery(text, schema), printQuery(query, schema), suggest(text, schema)',
    how: 'Columns resolve by id, label or alias, enum values by value or label. Numbers accept 2k and $5,000, dates accept 2026-01, today, last 30 days, this quarter. Errors carry offsets. Use the tally_parse_query tool to check a string before shipping it.',
    example: `const { query, errors } = parseQuery('plan is pro or team and renewal next 30 days sort by mrr desc', schema)`,
    guide: 'core',
    keywords: [
      'query',
      'filter',
      'syntax',
      'grammar',
      'parse',
      'language',
      'dsl',
      'sort',
      'group',
      'search',
      'expression',
    ],
  },
]

export function findExtensionPoints(change: string, limit = 3): readonly ExtensionPoint[] {
  const terms = [...new Set(tokenize(change))]
  if (terms.length === 0) return []
  const text = change.toLowerCase()
  return EXTENSION_POINTS.map((point) => {
    const titleTokens = new Set(tokenize(point.title))
    let score = 0
    for (const keyword of point.keywords) {
      if (keyword.includes(' ')) {
        if (text.includes(keyword)) score += 3
        continue
      }
      if (terms.some((term) => term === keyword || (term.length > 3 && keyword.startsWith(term))))
        score += 2
    }
    for (const term of terms) if (titleTokens.has(term)) score += 1
    return { point, score }
  })
    .filter((entry) => entry.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.point)
}

export function renderExtensionPoints(): string {
  const lines = ['# Where each change goes', '']
  for (const point of EXTENSION_POINTS) {
    lines.push(
      `## ${point.title}`,
      '',
      `Package: \`${point.package}\``,
      `API: \`${point.api}\``,
      '',
      point.how,
      '',
      '```',
      point.example,
      '```',
      '',
    )
  }
  return lines.join('\n')
}
