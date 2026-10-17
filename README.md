<p align="center">
  <img src=".github/readme/playground.jpg" alt="Tally grid showing accounts with typed columns, sparklines, health bars and a footer of aggregates" width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tally-react"><img src="https://img.shields.io/npm/v/tally-react?label=tally-react" alt="tally-react on npm" /></a>
  <a href="https://github.com/MohmmedAshraf/tally/actions/workflows/ci.yml"><img src="https://github.com/MohmmedAshraf/tally/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

# Tally

The data grid with a query language, saved views and a backend protocol. Typed columns, grouping, live rows, undo, cards on phones, AI that writes real queries, and an MCP server so your coding agent knows where every change goes.

[Documentation](https://tally.outhebox.dev/docs) · [Playground](https://play.tally.outhebox.dev) · [tally.outhebox.dev](https://tally.outhebox.dev)

## Why Tally

- **Typed columns.** Fourteen built-in types: `text`, `number`, `int`, `currency`, `percent`, `date`, `enum`, `bool`, `person`, `email`, `url`, `id`, `duration` and `bar`. Each one brings its own filters, formatting, editor, aggregates and facets. Add your own with the same API.
- **A query language instead of a filter builder.** `plan is pro or team and renewal next 30 days sort by mrr` parses into a validated AST, prints back to text, and runs in memory or on your database. Autocomplete and error offsets come with it.
- **Views.** Filter, sort, group, column order, pins, density and layout are one serializable `View`. Save them, put them in the URL, send them to the server.
- **Grouping with aggregates and facets.** Group by any column, bucket dates by day, week, month, quarter or year, and get sums, averages and distributions per group and in the footer.
- **Live rows.** Patches from the server or from your own code re-rank rows in place when a sorted value changes. Edits, pastes, fills and imports are mutations with labels, so undo reads `Undid Paste 2 cells`.
- **Cards on phones.** The same grid becomes a card list below a breakpoint, with a bottom sheet for the full record.
- **One protocol, many backends.** The Tally Query Protocol is JSON with a published JSON Schema and a conformance suite. `tally-server` compiles it to SQL with Kysely and passes the same cases as the in-memory engine on SQLite and Postgres; `tally/laravel` does the same with Eloquent on SQLite, Postgres and MySQL.
- **AI that stays inside the schema.** `ask` turns a sentence into Tally query text, parses it against your columns, and only applies a query that validates. AI columns fill in through live patches.
- **Built for coding agents.** `tally-mcp-server` serves every guide, maps a change in plain words to the extension point that owns it, parses queries, validates requests and infers schemas from data.
- **Accessible, international, fast.** WAI-ARIA grid semantics with a live announcer, keyboard navigation that follows the screen in right-to-left layouts, locale-aware numbering, and smooth scrolling at 100,000 rows by 50 columns.

## Quick start

```sh
npm install tally-react tally-core react react-dom
```

```tsx
import { useState } from 'react'
import { createArraySource, createSchema } from 'tally-core'
import { Tally, useGrid } from 'tally-react'
import 'tally-react/styles.css'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', pin: 'left' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
    { id: 'growth', type: 'percent' },
    { id: 'renewal', type: 'date' },
  ],
})

function Accounts({ rows }) {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({ schema, source })
  return <Tally grid={grid} label="Accounts" />
}
```

Type into the filter bar:

```
status is active and mrr > 2k
plan is pro or team
renewal last 30 days
owner is empty
acme corp, status is active
sort by mrr desc
group by plan
```

## Backends

Point the grid at a server instead of an array. The server validates every request against `tally-protocol` before any SQL runs.

**Node, any SQL database through Kysely:**

```ts
import { createKyselyAdapter, createTallyHandler } from 'tally-server'

const accounts = createKyselyAdapter({ db, table: 'accounts', schema, dialect: postgresDialect })
const handler = createTallyHandler({ source: accounts, schema, basePath: '/api/accounts' })

app.all('/api/accounts/*', (c) => handler(c.req.raw))
```

**Laravel:**

```php
final class AccountsGrid extends Grid
{
    public function query(): Builder
    {
        return Account::query()->whereBelongsTo(auth()->user()->team);
    }

    public function columns(): array
    {
        return [
            ['id' => 'account', 'label' => 'Account'],
            ['id' => 'mrr', 'label' => 'MRR', 'type' => 'currency', 'aggregate' => 'sum'],
        ];
    }
}

Route::tally('/api/accounts', AccountsGrid::class);
```

**In the browser:**

```ts
import { connectHttpSource } from 'tally-adapters'

const { schema, source } = await connectHttpSource({ url: '/api/accounts' })
const grid = useGrid({ schema, source })
```

`tally-adapters` also wraps TanStack Query, TanStack DB and Supabase, with realtime patches where the backend supports them.

## AI and agents

```ts
import { ask } from 'tally-ai'

const result = await ask('team plans renewing this quarter, biggest first', { model, schema })
```

The model answers in Tally query text. The text is parsed against your schema, parse errors go back for one repair round, and only a query that parses is returned. Any AI SDK language model works.

Give your coding agent the same knowledge:

```sh
claude mcp add tally -- npx tally-mcp-server
```

Any MCP client can use it. It serves the package guides as resources, answers "where does this change go?" with the exact extension point, package and snippet, and validates protocol requests the way the server does.

## Packages

| Package                               | What it is                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| [`tally-core`](packages/core)         | Framework-free engine: types, schema, query language, views, executor, mutations |
| [`tally-react`](packages/react)       | The full component plus headless hooks                                           |
| [`tally-vue`](packages/vue)           | Composables over the engine                                                      |
| [`tally-svelte`](packages/svelte)     | Svelte 5 runes and stores over the engine                                        |
| [`tally-solid`](packages/solid)       | Solid primitives over the engine                                                 |
| [`tally-protocol`](packages/protocol) | Wire types, JSON Schema and the conformance suite                                |
| [`tally-server`](packages/server)     | Kysely SQL adapter and Fetch handler with server-sent events                     |
| [`tally/laravel`](packages/php)       | Eloquent adapter, `Route::tally()`, Pest conformance on three databases          |
| [`tally-adapters`](packages/adapters) | HTTP, TanStack Query, TanStack DB and Supabase sources                           |
| [`tally-ai`](packages/ai)             | Natural language to query, AI columns, column design                             |
| [`tally-mcp-server`](packages/mcp)    | MCP server: guides, extension points, query and schema tools                     |

Each package README is the reference for that package. The documentation in [`docs`](docs) is a Mintlify site whose reference pages are generated from the code.

## Extending

Everything a consumer sees can be replaced or extended without forking:

- **Renderers and editors** per column type or kind, through props on `<Tally>`.
- **Column types** with their own operators, formatting, aggregates and facets, registered next to the built-ins.
- **Labels** for every string in the UI, and a `dir` prop or ancestor for right-to-left layouts.
- **Intents** to intercept any keyboard or pointer action before the grid handles it.
- **Styling** through CSS variables for every color, spacing and radius, with light and dark themes.
- **Data sources** by implementing one interface, and **SQL dialects** by supplying the few functions engines disagree on.

Ask `tally_where` on the MCP server for the extension point that owns a change, or read the `extend` guide it generates.

## Development

```sh
pnpm install
pnpm check
```

`pnpm check` runs lint, typecheck, tests with coverage thresholds, build, publish checks and size limits for every package. The playground runs with `pnpm --filter playground dev`, the docs with `pnpm --filter tally-docs-content dev`, and the Laravel package with `composer check` inside `packages/php`.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
