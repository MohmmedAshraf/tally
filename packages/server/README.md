# tally-server

Serves the Tally Query Protocol from a SQL database. A Kysely adapter compiles filter, sort, group, aggregate, facet and page requests into SQL, and a Fetch-standard handler exposes any `DataSource` over HTTP with server sent events for live patches.

Not published yet.

## Install

```sh
npm install tally-server tally-core tally-protocol kysely
```

Kysely is a peer dependency. Bring the driver for your database: `pg`, `better-sqlite3`, `mysql2`, or `node:sqlite` through the included bridge.

## Adapter

```ts
import { DatabaseSync } from 'node:sqlite'
import { Kysely, SqliteDialect } from 'kysely'
import { createSchema } from 'tally-core'
import { createKyselyAdapter, nodeSqlite, sqliteDialect } from 'tally-server'

const db = new Kysely({
  dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync('app.db')) }),
})

const schema = createSchema({ key: 'id', columns })

const accounts = createKyselyAdapter({ db, table: 'accounts', schema, dialect: sqliteDialect })
```

| Option       | Default  | Notes                                                                 |
| ------------ | -------- | --------------------------------------------------------------------- |
| `db`         |          | A `Kysely` instance.                                                  |
| `table`      |          | Table or view name.                                                   |
| `schema`     |          | From `createSchema`. The key must be a field name, not a function.    |
| `dialect`    | `sqlite` | `sqliteDialect`, `postgresDialect` or your own `SqlDialect`.          |
| `columns`    |          | Column id to SQL column name, for `{ fullName: 'full_name' }`.        |
| `flags`      |          | Named `sql` expressions that `flag` filters compile to.               |
| `pagination` | `offset` | `offset` or `cursor`. Cursors are opaque and encode the offset.       |
| `maxLimit`   | `1000`   | Page sizes above this are clamped.                                    |
| `mutable`    | `true`   | `false` refuses `PATCH /rows`.                                        |
| `today`      | now      | ISO date that relative ranges such as `last 30 days` resolve against. |
| `bins`       | `20`     | Histogram bins.                                                       |
| `maxTerms`   | `50`     | Terms facet size.                                                     |

Every request is validated with `tally-protocol` before any SQL runs. Mutations run in one transaction and return the canonical rows read back from the database.

### Semantics

The adapter passes the `tally-protocol` conformance suite on SQLite and Postgres, so filters, sorts, groups, aggregates, facets and pages match the in-memory engine:

- Empty means `NULL`, and for text columns also `''`. Empty values sort last in both directions and never match comparisons, except `neq`, `notContains` and `notIn`, which keep them.
- Text comparisons are case insensitive through `lower()`. SQLite folds ASCII only.
- Enum columns sort and facet in option order.
- Date groups bucket to `YYYY-MM-DD`, ISO Monday weeks, `YYYY-MM`, `YYYY-Qn` or `YYYY`.
- Search matches the stored value of searchable columns, not the formatted text.
- Group order follows the sort on the group column when there is one, otherwise option or natural order, newest dates first.

### Dialects

A `SqlDialect` supplies the few functions SQL engines disagree on: `lower`, `float`, `floor`, `dayNumber`, `dateBucket`, plus `encode` and `decode` for values crossing the driver. Implement it for MySQL or SQL Server and pass it as `dialect`.

With `pg`, `date` columns come back as local `Date` objects and are converted to ISO dates. Numeric aggregates arrive as strings and are converted to numbers.

## Handler

```ts
import { createTallyHandler } from 'tally-server'

const handler = createTallyHandler({ source: accounts, schema, basePath: '/api/accounts' })
```

The handler is `(request: Request) => Promise<Response>`, so it mounts anywhere Fetch is the interface:

```ts
app.all('/api/accounts/*', (c) => handler(c.req.raw))
```

| Route         | Body                     | Response                                                    |
| ------------- | ------------------------ | ----------------------------------------------------------- |
| `GET /schema` |                          | `{ version, columns, capabilities, key }`                   |
| `POST /query` | `QueryRequest`           | `QueryResponse`                                             |
| `PATCH /rows` | `{ version, mutations }` | `MutationResult`, or `405` when the source is read only     |
| `GET /events` |                          | `text/event-stream` of `patch` events carrying a `RowPatch` |

Accepted mutations are broadcast to every open event stream, and patches from a source with `live` capability are relayed. Invalid requests return `400` with `{ code, message, details }` where every detail names the path of a problem.

## Testing your own adapter

```ts
import { runConformance } from 'tally-protocol'

const report = await runConformance((request) => adapter.query(request), {
  capabilities: adapter.capabilities,
})
expect(report.failures).toEqual([])
```
