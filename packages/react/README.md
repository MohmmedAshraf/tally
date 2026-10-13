# tally-react

React component and hooks for Tally. The engine lives in `tally-core`; this package renders it: virtualized rows and columns, pinned columns and rows, column groups, sorting, grouping, a natural-language filter bar with chips and typed popovers, inline editing with undo, fill handle, copy and paste, keyboard navigation, conditional formatting, a column menu, row context menu, footer aggregates, offset or cursor pagination and a card layout for narrow viewports.

Not published yet.

## Install

```sh
npm install tally-react tally-core react react-dom
```

React 19 or newer.

## Usage

```tsx
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

`useGrid` creates a `Grid` from `tally-core`, loads it on mount and disposes it on unmount. It recreates the grid when `schema` or `source` change identity, and when the format context changes, carrying the current view over.

## `<Tally>`

| Prop                 | Type                                           | Notes                                                                       |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `grid`               | `Grid`                                         | From `useGrid` or `createGrid`.                                             |
| `label`              | `string`                                       | Accessible name of the grid.                                                |
| `theme`              | `'light' \| 'dark'`                            | Omit to follow `prefers-color-scheme`.                                      |
| `dir`                | `'ltr' \| 'rtl'`                               | Layout uses logical properties; numbers and dates stay left to right.       |
| `layout`             | `'auto' \| 'grid' \| 'cards'`                  | `auto` switches to cards below `cardsBelow` pixels.                         |
| `cardsBelow`         | `number`                                       | Default `620`.                                                              |
| `toolbar`            | `ReactNode \| boolean`                         | `true` renders the default toolbar, `false` hides it, a node replaces it.   |
| `ask`                | `(question, grid) => Promise<AskResult>`       | Enables ask mode in the filter bar. `tally-ai` provides a handler.          |
| `renderers`          | `CellRenderers`                                | Cell renderers by column type name or kind, merged over `defaultRenderers`. |
| `editors`            | `CellEditors`                                  | Cell editors by column type name or kind, merged over `defaultEditors`.     |
| `labels`             | `Partial<TallyLabels>`                         | Every string in the UI, merged over `defaultLabels`.                        |
| `onIntent`           | `(intent: GridIntent) => boolean \| undefined` | Runs before the built-in handler. Return `true` to consume the intent.      |
| `initialSize`        | `{ width, height }`                            | Viewport size before the first measurement, for server rendering and tests. |
| `className`, `style` |                                                | Applied to the root element.                                                |

Children render inside the toolbar.

## Hooks

| Hook                          | Returns                                       |
| ----------------------------- | --------------------------------------------- |
| `useGrid(options)`            | A `Grid` bound to the component lifecycle.    |
| `useGridState(grid, select?)` | Status, totals, aggregates, facets and page.  |
| `useView(grid, select?)`      | The current `View`.                           |
| `useRows(grid)`               | Loaded rows, their version and changed cells. |
| `useSelection(grid)`          | Active cell, ranges and selected rows.        |
| `useColumnLayout(grid)`       | Visible columns with widths and pin edges.    |
| `useRowModel(grid)`           | Flattened rows, groups and pinned rows.       |
| `useGridContext()`            | The nearest `Grid` from `GridProvider`.       |

Selectors keep components from re-rendering when unrelated state changes.

## Extending

### Renderers and editors

A renderer receives the raw value, the formatted text, the row, the column, the column type and the format context. Keys match a column type name first, then its kind.

```tsx
const renderers = {
  currency: ({ text, value }) => <span data-negative={value < 0}>{text}</span>,
}

<Tally grid={grid} renderers={renderers} />
```

An editor receives `commit(value, move?)` and `cancel()`. `move` is `'down'`, `'up'`, `'right'` or `'left'` and decides where focus goes after the commit.

### Labels

```tsx
<Tally grid={grid} labels={{ filterPlaceholder: 'Filtern…', rows: (n) => `${n} Zeilen` }} />
```

### Intents

Keyboard and mouse input becomes a `GridIntent` from `tally-core`. `onIntent` sees every intent first, so a host can bind its own command palette or inspector, or block an action.

```tsx
<Tally
  grid={grid}
  onIntent={(intent) => {
    if (intent.type === 'commandPalette') {
      openPalette()
      return true
    }
    return undefined
  }}
/>
```

### Composition

The default toolbar is made of exported parts: `Toolbar`, `FilterBar`, `Chip`, `DisplayMenu`, `Pager`, `HeaderMenu`, `RulesPopover` and `RowMenu`. Pass `toolbar={false}` and render your own arrangement with `useGridContext`.

## Styling

Import `tally-react/styles.css` once. The default type is Onest with JetBrains Mono for numbers; import `tally-react/fonts.css` to self-host both through `@fontsource-variable/onest` and `@fontsource-variable/jetbrains-mono`, or leave it out and the system stack takes over.

```ts
import 'tally-react/styles.css'
import 'tally-react/fonts.css'
```

Every rule sits in `@layer tally`, so unlayered styles win without specificity games. Colors use `light-dark()` and follow `color-scheme`; override tokens on `.tally` or any ancestor:

```css
.tally {
  --tally-accent: oklch(0.6 0.18 30);
  --tally-radius: 6px;
  --tally-font: 'Inter', sans-serif;
  --tally-row-height: 40px;
}
```

Tokens: `--tally-bg`, `--tally-canvas`, `--tally-soft`, `--tally-hover`, `--tally-ink`, `--tally-ink-2`, `--tally-ink-3`, `--tally-line`, `--tally-line-2`, `--tally-line-strong`, `--tally-accent`, `--tally-up`, `--tally-up-soft`, `--tally-down`, `--tally-down-soft`, `--tally-warn`, `--tally-warn-ink`, `--tally-warn-soft`, `--tally-ai`, `--tally-ai-soft`, `--tally-ai-ink`, `--tally-selection`, `--tally-selection-row`, `--tally-ring`, `--tally-popup`, `--tally-radius`, `--tally-radius-sm`, `--tally-radius-xs`, `--tally-font`, `--tally-font-mono`, `--tally-font-size`, `--tally-row-height`, `--tally-header-height`, `--tally-group-height`, `--tally-footer-height`, `--tally-gutter-width`, `--tally-cell-padding`.

State is exposed as data attributes for targeted overrides: `data-density`, `data-theme`, `data-pin`, `data-pin-edge`, `data-sorted`, `data-active`, `data-range`, `data-selected`, `data-editing`, `data-sign`, `data-rule`, `data-layout`.

## Keyboard

| Keys                                | Action                               |
| ----------------------------------- | ------------------------------------ |
| Arrows, Home, End, PageUp, PageDown | Move the active cell                 |
| Shift + arrows                      | Extend the range                     |
| Cmd/Ctrl + arrows, Home, End        | Jump to the edge                     |
| Tab, Shift + Tab                    | Next and previous cell               |
| Enter, F2, typing                   | Edit the active cell                 |
| Escape                              | Cancel editing or clear the range    |
| Shift + Space                       | Toggle the row                       |
| Space                               | `inspect` intent for the host        |
| Alt + Left, Alt + Right             | Collapse and expand a tree row       |
| Delete, Backspace                   | Clear the range                      |
| Cmd/Ctrl + C, X, V                  | Copy, cut and paste as TSV           |
| Cmd/Ctrl + Z, Shift + Z, Y          | Undo and redo                        |
| Cmd/Ctrl + A                        | Select all cells                     |
| Cmd/Ctrl + K                        | `commandPalette` intent for the host |
| /                                   | Focus the filter bar                 |

## Bundle

Own code is under 20 kB brotli. With Base UI, TanStack Virtual, Pragmatic drag and drop and Lucide it is under 90 kB. `tally-core`, `react` and `react-dom` are not included in those numbers.
