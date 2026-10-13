# tally-adapters

Client data sources for Tally. Each one implements the `DataSource` contract from `tally-core`, so a grid does not care whether rows come from an array, an HTTP endpoint, a query cache or a sync engine.

Not published yet.

## Install

```sh
npm install tally-adapters tally-core
```

## HTTP

Talks to any server that speaks the Tally Query Protocol, such as `tally-server`. One round trip fetches the schema and the capabilities, and the returned source handles `/query`, `/rows` and the `/events` stream.

```ts
import { connectHttpSource } from 'tally-adapters'
import { Tally, useGrid } from 'tally-react'

const { schema, source } = await connectHttpSource({
  url: '/api/tally',
  headers: () => ({ authorization: `Bearer ${token()}` }),
})

const grid = useGrid({ schema, source })
```

| Option     | Type                                             | Notes                                            |
| ---------- | ------------------------------------------------ | ------------------------------------------------ |
| `url`      | `string`                                         | Base URL of the handler, relative or absolute.   |
| `headers`  | `HeadersInit \| () => HeadersInit \| Promise<…>` | Sent with every request and the event stream.    |
| `fetch`    | `typeof fetch`                                   | Defaults to the global `fetch`.                  |
| `registry` | `TypeRegistry`                                   | Custom column types the server schema refers to. |

`createHttpSource` builds a source without the schema round trip when the capabilities are already known, and `fetchSchema` returns the raw `SchemaResponse`.

Responses are validated against the protocol schemas. Protocol failures surface as `HttpSourceError` with `status`, `code`, `message` and `details`, matching the error body of the handler. Query requests pass the grid's `AbortSignal` through, so a superseded request is cancelled on the wire.

Live patches arrive over server sent events. The stream reconnects on its own and is closed when the grid disposes. Sources whose server reports `live: false` expose no `subscribe`, and read only servers expose no `mutate`.

## TanStack Query

Wraps any source so its requests go through a `QueryClient`: identical requests are deduped, results are cached by request, and the devtools show every grid query. Import from `tally-adapters/query`.

```ts
import { QueryClient } from '@tanstack/query-core'
import { createQuerySource } from 'tally-adapters/query'

const client = new QueryClient()
const source = createQuerySource({
  client,
  source: remote,
  queryKey: ['accounts'],
  staleTime: 30_000,
})
```

Queries are keyed `[...queryKey, 'query', request]` and the schema `[...queryKey, 'schema']`. An accepted mutation or a live patch invalidates every query under the key, so the next request refetches. `source.invalidate()` does the same by hand.

## TanStack DB

Runs the grid over a collection: filters, sorts, groups, aggregates and facets execute locally with the reference engine, collection changes arrive as live patches, and edits go through `insert`, `update` and `delete` so the collection's own persistence handlers and optimistic state apply. Import from `tally-adapters/db`.

```ts
import { createCollection, queryCollectionOptions } from '@tanstack/db'
import { createCollectionSource } from 'tally-adapters/db'

const accounts = createCollection(
  queryCollectionOptions({ queryKey: ['accounts'], queryFn, queryClient, getKey: (row) => row.id }),
)
const source = createCollectionSource(accounts, schema)
```

| Option    | Type                        | Notes                                                          |
| --------- | --------------------------- | -------------------------------------------------------------- |
| `mutable` | `boolean`                   | Default `true`.                                                |
| `item`    | `(row: RowData) => RowData` | Maps a new grid row to a collection item before `insert`.      |
| `today`   | `string`                    | Reference date for relative ranges, as in `createArraySource`. |

Virtual properties the collection adds to items, such as `$hasPendingWrites`, are stripped from rows.

## Conformance

Every adapter in this package runs the `tally-protocol` conformance suite against the reference executor, so a filter means the same thing on every backend.

```ts
import { runConformance } from 'tally-protocol'

const report = await runConformance((request) => source.query(request), {
  capabilities: source.capabilities,
})
```
