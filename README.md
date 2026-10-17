# Tally

A data grid with typed columns, a query language, saved views, and a backend protocol. Works in React first, then Vue, Svelte and Solid, against arrays or any server that speaks the Tally Query Protocol.

Tally is under active development and is not published yet.

## Packages

| Package            | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| `tally-core`       | Framework-free engine: types, schema, query grammar, view state, executor, mutations |
| `tally-react`      | Headless hooks and the full component                                                |
| `tally-protocol`   | Wire protocol types, JSON Schema and conformance suite                               |
| `tally-server`     | Node adapter compiling protocol requests to SQL                                      |
| `tally-adapters`   | Client data sources: array, TanStack Query, TanStack DB, Supabase                    |
| `tally-ai`         | Natural language to query, AI columns                                                |
| `tally-mcp-server` | MCP server that teaches coding agents Tally: guides, extension points, query tools   |
| `tally-tools`      | Schema and adapter generation from a database or API                                 |

## Development

```sh
pnpm install
pnpm check
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
