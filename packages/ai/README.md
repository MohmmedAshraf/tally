# tally-ai

Natural language to query and AI columns for Tally. Works with any model the [AI SDK](https://ai-sdk.dev) can call: Anthropic, OpenAI, Google, Mistral, Ollama, a gateway model id or your own provider.

Not published yet.

## Install

```sh
npm install tally-ai ai @ai-sdk/anthropic
```

## Ask

`ask` turns a question into a validated Tally query. The model answers in Tally query text, the text is parsed against your schema, and parse errors go back to the model for one repair round. Only a query that parses is returned, so the model never applies free text to a view.

```ts
import { anthropic } from '@ai-sdk/anthropic'
import { createSchema } from 'tally-core'
import { ask } from 'tally-ai'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'plan', type: 'enum', options: [{ value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
  ],
})

const result = await ask('team plans renewing this quarter, biggest first', {
  model: anthropic('claude-sonnet-5-5'),
  schema,
})

result.text
// 'plan is team and renewal this quarter, sort by mrr desc'
result.query
// { filter: { type: 'and', filters: [...] }, sort: [{ column: 'mrr', direction: 'desc' }] }
result.explanation
// 'Team accounts whose renewal falls in this quarter, largest MRR first'
```

Options:

| Option     | Default        | Purpose                                        |
| ---------- | -------------- | ---------------------------------------------- |
| `model`    |                | Any AI SDK `LanguageModel`                     |
| `schema`   |                | The grid schema the query is validated against |
| `examples` | `[]`           | Example queries shown to the model             |
| `context`  | `en-US`, `UTC` | Format context; the time zone resolves `today` |
| `now`      | `new Date()`   | Clock for relative dates                       |
| `repairs`  | `1`            | Repair rounds after a parse error              |
| `signal`   |                | Abort signal passed to the model call          |

When the model cannot produce a parseable query, `ask` throws an `AskError` carrying every attempt and its parse errors.

### With tally-react

`createAskHandler` returns the `ask` handler for the `ai` prop of `Tally`. The schema comes from the grid. Text typed into the filter bar that does not parse as a query, or reads like a sentence, goes to the handler and the answer lands as filter chips.

```tsx
import { createAskHandler } from 'tally-ai'

const ai = { ask: createAskHandler({ model: anthropic('claude-sonnet-5-5') }) }

<Tally grid={grid} ai={ai} />
```

Model calls need an API key. In a browser app point the provider at a same-origin proxy that adds the key, as the playground does in `examples/playground/server/anthropic.ts`, so `ask`, `designColumn` and `withAiColumns` all run on the client.

## AI columns

`withAiColumns` wraps any data source. Rows come back immediately, the model fills the AI columns in batches, and the values arrive as live patches, so the grid updates the cells as they resolve. Values are cached per row and recomputed when their input columns change.

```ts
import { createArraySource, createSchema } from 'tally-core'
import { withAiColumns } from 'tally-ai'

const schema = createSchema({
  columns: [
    { id: 'account' },
    { id: 'notes' },
    {
      id: 'mood',
      type: 'enum',
      options: [{ value: 'happy' }, { value: 'neutral' }, { value: 'unhappy' }],
      filterable: false,
      sortable: false,
      groupable: false,
    },
  ],
})

const source = withAiColumns(createArraySource(rows, schema), schema, [
  {
    column: 'mood',
    model: anthropic('claude-haiku-5-5'),
    instruction: 'Judge the customer mood from the notes.',
    inputs: ['notes'],
  },
])
```

AI columns are computed on the client, so they must be declared with `filterable`, `sortable` and `groupable` set to `false`. Mark them `ai: true` and `tally-react` renders the header with a sparkle, shows a shimmer while a value is pending and reveals it when it arrives. The returned source exposes `pending(column?)` with the keys still being computed and `idle()`, a promise that resolves when every batch has finished.

### Designing a column from a prompt

`designColumn(prompt, { model, schema })` asks the model for a column definition and the instruction to fill it, ready for `withAiColumns`. The column comes back as `ai: true`, non filterable, non sortable and non groupable, with a unique id and, for enums, tinted options.

```ts
import { designColumn, withAiColumns } from 'tally-ai'

const { column, instruction } = await designColumn('Churn risk, low, medium or high', {
  model: anthropic('claude-sonnet-5-5'),
  schema,
})
const extended = schema.extend([column], 1)
const source = withAiColumns(base, extended, [{ column: column.id, model, instruction }])
```

`tally-react` wires this up through the `addColumn` handler of the `ai` prop: the AI button opens a prompt, the handler returns the new column id, and the grid animates the column in. The playground keeps the added columns in state and rebuilds the schema and source, which `useGrid` picks up while keeping the current view.

| Option        | Default             | Purpose                                        |
| ------------- | ------------------- | ---------------------------------------------- |
| `column`      |                     | Id of the column to fill                       |
| `model`       |                     | Any AI SDK `LanguageModel`                     |
| `instruction` |                     | What to compute                                |
| `inputs`      | every non-AI column | Columns sent to the model for each row         |
| `batchSize`   | `20`                | Rows per model call                            |
| `concurrency` | `2`                 | Model calls in flight per column               |
| `cache`       | in-memory `Map`     | Anything with `get(key)` and `set(key, value)` |

## Prompts

`describeSchema(schema, options)` returns the system prompt `ask` uses: the query grammar, every visible column with its type, operators, enum values, aliases and limits, optional examples and today's date. Use it when you drive your own agent loop.
