# tally-mcp-server

An MCP server that teaches coding agents Tally. It serves every package guide as a resource, maps a change in plain words to the extension point that owns it, parses query text, validates protocol requests and infers a schema from data. Add it once and an agent working in your codebase knows where each change goes.

Not published yet.

## Install

```sh
claude mcp add tally -- npx tally-mcp-server
```

Any MCP client works. The server speaks stdio:

```json
{
  "mcpServers": {
    "tally": { "command": "npx", "args": ["tally-mcp-server"] }
  }
}
```

## Resources

| URI                      | Content                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `tally://guide/overview` | Packages and how they fit together                                                                                       |
| `tally://guide/extend`   | Where each change goes: package, API and a snippet per extension point                                                   |
| `tally://guide/core`     | Schema, column types, query language, views, executor, mutations                                                         |
| `tally://guide/react`    | The component, hooks, renderers, editors, labels, intents, styling                                                       |
| `tally://guide/protocol` | Wire schemas, validation, JSON Schema, conformance suite                                                                 |
| `tally://guide/server`   | Kysely SQL adapter, dialects, Fetch handler, SSE                                                                         |
| `tally://guide/php`      | tally/laravel: grid classes, `Route::tally()`, Eloquent query compiler, dialects                                         |
| `tally://guide/adapters` | HTTP, TanStack Query, TanStack DB and Supabase sources                                                                   |
| `tally://guide/ai`       | Natural language to query, AI columns, column design                                                                     |
| `tally://schema/{name}`  | JSON Schema for `query-request`, `query-response`, `mutation-request`, `mutation-result`, `row-patch`, `schema-response` |

The guides are the package READMEs, copied at build time, so they never drift from the code.

## Tools

| Tool                     | Input                               | Returns                                                                 |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------- |
| `tally_where`            | `change`                            | The extension points that own the change, with package, API and example |
| `tally_search`           | `query`, `limit`                    | The best matching guide sections                                        |
| `tally_parse_query`      | `text`, `columns`                   | The query AST, its canonical form and parse errors with offsets         |
| `tally_validate_request` | `kind`, `request`, `columns`, `key` | Every problem by path, exactly as `tally-server` reports it             |
| `tally_infer_schema`     | `rows` or `csv`, `key`              | Columns with detected types and enum options, ready for `createSchema`  |

`columns` takes the same objects as `createSchema`.

## Embedding

```ts
import { createTallyServer } from 'tally-mcp-server'

const server = createTallyServer({ guides: { core: coreReadme, react: reactReadme } })
await server.connect(transport)
```

`guides` maps a name to markdown; the `extend` guide is always generated from the extension points.

`findExtensionPoints`, `searchSections`, `parseQueryText`, `validateRequest`, `inferFromRows` and `inferFromCsv` are exported for use without a server.
