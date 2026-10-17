import { computed, type ComputedRef, type Ref } from 'vue'
import { createArraySource, createSchema, type RowData } from 'tally-core'
import { useGrid, useGridState } from 'tally-vue'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
  ],
})

export function useAccounts(rows: Ref<readonly RowData[]>): {
  sortByMrr: () => void
  total: ComputedRef<number | undefined>
} {
  const grid = useGrid(() => ({ schema, source: createArraySource(rows.value, schema) }))
  const state = useGridState(grid)
  return {
    sortByMrr: () => grid.value.view.toggleSort('mrr'),
    total: computed(() => state.value.total),
  }
}
