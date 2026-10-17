import { expect, test } from 'vitest'
import { execute } from '../execute/executor.ts'
import { compileSort, sortRows } from '../execute/sort.ts'
import { createExecutionContext } from '../execute/context.ts'
import { parseQuery } from '../query/parse.ts'
import type { RowData } from '../rows/row.ts'
import { createRowStore } from '../rows/store.ts'
import { createArraySource } from '../source/array-source.ts'
import { createStressRows, createStressSchema, seeded } from '../test/stress.ts'
import { defaultView } from '../view/view.ts'
import { createGrid } from './grid.ts'
import { buildRowModel } from './model.ts'
import { facetColumns } from './plan.ts'

const schema = createStressSchema()
const rows = createStressRows()
const context = createExecutionContext({ today: '2026-10-13' })
const parsed = parseQuery(
  'enum1 is e1-0 or e1-1 and currency1 > 100 sort by currency2 desc group by enum2',
  schema,
).query
const request = {
  filter: parsed.filter,
  sort: parsed.sort,
  group: parsed.group,
  aggregates: [
    { column: 'currency1', fn: 'sum' },
    { column: 'int1', fn: 'avg' },
    { column: 'enum3', fn: 'distinct' },
    { column: 'date1', fn: 'min' },
  ],
  facets: facetColumns(schema),
} as const
const order = compileSort([{ column: 'currency2', direction: 'desc' }], schema, context)
const sorted = sortRows(rows, [{ column: 'currency2', direction: 'desc' }], schema, context)
const random = seeded(9)
const patchKeys = Array.from({ length: 1000 }, () => Math.floor(random() * rows.length))

function patchRows(round: number): readonly RowData[] {
  return patchKeys.flatMap((key) => {
    const row = rows[key]
    if (row === undefined) return []
    return [{ ...row, currency2: ((key * 7919 + round * 104_729) % 100_000) / 100 }]
  })
}

const store = createRowStore(schema, sorted)
const view = { ...defaultView(schema), sort: parsed.sort }
const source = createArraySource(rows, schema)
const grid = createGrid({ schema, source, view })
await grid.load()
const groupedView = { ...defaultView(schema), group: { column: 'enum2' } }
const groupedRows = sortRows(rows, [{ column: 'enum2', direction: 'asc' }], schema, context)
let round = 0
const budgets = { full: 800, incremental: 100 }

test(
  '100k rows by 50 columns stay under the latency budget',
  { timeout: 120_000 },
  async ({ bench }) => {
    const result = await bench.compare(
      bench('full query', () => {
        execute(rows, request, schema, { today: '2026-10-13' })
      }),
      bench('patch 1k rows with live sort', () => {
        round += 1
        store.patch({ upserts: patchRows(round) }, order)
      }),
      bench('live patch through the grid', () => {
        round += 1
        source.patch({ upserts: patchRows(round) })
      }),
      bench('row model with groups', () => {
        buildRowModel({ rows: groupedRows, view: groupedView, schema })
      }),
      { iterations: 12, time: 0, warmupIterations: 2, warmupTime: 0 },
    )
    expect(result.get('full query').latency.mean).toBeLessThan(budgets.full)
    for (const name of [
      'patch 1k rows with live sort',
      'live patch through the grid',
      'row model with groups',
    ] as const) {
      expect(result.get(name).latency.mean).toBeLessThan(budgets.incremental)
    }
  },
)
