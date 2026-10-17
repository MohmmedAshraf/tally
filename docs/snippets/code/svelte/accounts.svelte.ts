import { createArraySource, createSchema, type RowData } from 'tally-core'
import { gridState, useGrid, type ReactiveGrid } from 'tally-svelte'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
  ],
})

export function useAccounts(rows: () => readonly RowData[]): {
  grid: ReactiveGrid
  total: () => number | undefined
} {
  const grid = useGrid(() => ({ schema, source: createArraySource(rows(), schema) }))
  const state = gridState(grid)
  return { grid, total: () => state.current.total }
}
