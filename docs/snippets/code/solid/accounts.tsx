import type { JSX } from 'solid-js'
import { createArraySource, createSchema, type RowData } from 'tally-core'
import { createGridState, createView, useGrid } from 'tally-solid'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
  ],
})

export function Accounts(props: { rows: readonly RowData[] }): JSX.Element {
  const source = createArraySource(props.rows, schema)
  const grid = useGrid({ schema, source })
  const state = createGridState(grid)
  const view = createView(grid)
  return (
    <>
      <p>
        {state().status}, sorted by {view().sort[0]?.column ?? 'nothing'}
      </p>
      <button type="button" onClick={() => grid().view.toggleSort('mrr')}>
        Sort by MRR
      </button>
    </>
  )
}
