<script lang="ts">
  import { createArraySource, createSchema } from 'tally-core'
  import { gridState, gridView, useGrid } from 'tally-svelte'

  let { rows } = $props()

  const schema = createSchema({
    key: 'id',
    columns: [
      { id: 'account', label: 'Account' },
      { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
    ],
  })
  const source = createArraySource(rows, schema)

  const grid = useGrid(() => ({ schema, source }))
  const state = gridState(grid)
  const view = gridView(grid)
</script>

<p>{state.current.status}, sorted by {view.current.sort[0]?.column ?? 'nothing'}</p>
<button onclick={() => grid.current.view.toggleSort('mrr')}>Sort by MRR</button>
