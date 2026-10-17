import { act, screen, waitFor } from '@testing-library/react'
import { createArraySource, createSchema, type DataSource, type RowData } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { gridReady, renderTally } from '../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'plan', label: 'Plan', type: 'enum' },
  { id: 'mrr', label: 'MRR', type: 'currency' },
] as const

const rows = [
  { id: 1, name: 'One', plan: 'pro', mrr: 10 },
  { id: 2, name: 'Two', plan: 'team', mrr: 20 },
  { id: 3, name: 'Three', plan: 'team', mrr: 30 },
]

function status(): HTMLElement {
  return screen.getByRole('status')
}

describe('Announcer', () => {
  it('owns the only polite status region and reports the first load', async () => {
    renderTally({ columns, rows })
    await gridReady('One')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(status()).toHaveAttribute('aria-live', 'polite')
    expect(status()).toHaveAttribute('aria-atomic', 'true')
    expect(status()).toHaveClass('tally-visually-hidden')
    await waitFor(() => expect(status()).toHaveTextContent('3 rows'))
  })

  it('announces sort, filter and group changes with the resulting row count', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() => harness.grid().view.setSort([{ column: 'mrr', direction: 'desc' }]))
    await waitFor(() => expect(status()).toHaveTextContent('Sorted by MRR descending. 3 rows'))
    act(() => harness.grid().view.setSort([]))
    await waitFor(() => expect(status()).toHaveTextContent('Sort cleared. 3 rows'))
    act(() =>
      harness.grid().view.setFilter({ type: 'condition', column: 'mrr', op: 'gt', value: 15 }),
    )
    await waitFor(() => expect(status()).toHaveTextContent(/^Filtered by .+\. 2 rows$/))
    act(() => harness.grid().view.setFilter(undefined))
    await waitFor(() => expect(status()).toHaveTextContent('Filter cleared. 3 rows'))
    act(() => harness.grid().view.setGroup('plan'))
    await waitFor(() => expect(status()).toHaveTextContent('Grouped by Plan. 3 rows'))
    act(() => harness.grid().view.setGroup(undefined))
    await waitFor(() => expect(status()).toHaveTextContent('Ungrouped. 3 rows'))
  })

  it('skips view parts that were replaced with equal values', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() =>
      harness.grid().view.update((view) => ({ ...view, sort: [], group: { column: 'plan' } })),
    )
    await waitFor(() => expect(status().textContent).toBe('Grouped by Plan. 3 rows'))
  })

  it('re-announces an identical message', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    await act(() => harness.grid().setCells([{ key: 1, column: 'mrr', value: 11 }]))
    await waitFor(() => expect(status().textContent).toBe('Edit MRR'))
    await act(() => harness.grid().setCells([{ key: 1, column: 'mrr', value: 12 }]))
    await waitFor(() => expect(status().textContent).toBe('Edit MRR\u00a0'))
  })

  it('announces loading while a user triggered query is pending', async () => {
    let hold: (() => void) | undefined
    const createSource = (input: readonly RowData[]): DataSource => {
      const base = createArraySource(input, createSchema({ columns }))
      return {
        ...base,
        query: async (request, signal) => {
          if (request.sort.length > 0) {
            await new Promise<void>((resolve) => {
              hold = resolve
            })
          }
          return base.query(request, signal)
        },
      }
    }
    const harness = renderTally({ columns, rows, createSource })
    await gridReady('One')
    act(() => harness.grid().view.setSort([{ column: 'mrr', direction: 'desc' }]))
    await waitFor(() => expect(status()).toHaveTextContent('Loading'))
    await act(async () => {
      hold?.()
      await Promise.resolve()
    })
    await waitFor(() => expect(status()).toHaveTextContent('Sorted by MRR descending. 3 rows'))
  })

  it('announces row selection counts', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() => harness.grid().selection.dispatch({ type: 'selectRows', keys: [1, 2] }))
    await waitFor(() => expect(status()).toHaveTextContent('2 selected'))
  })

  it('announces edits, undo and redo from the history labels', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    await act(() =>
      harness.grid().setCells(
        [
          { key: 1, column: 'mrr', value: 1 },
          { key: 2, column: 'mrr', value: 2 },
        ],
        'Paste',
      ),
    )
    await waitFor(() => expect(status()).toHaveTextContent('Paste 2 cells'))
    await act(() => harness.grid().undo())
    await waitFor(() => expect(status()).toHaveTextContent('Undid Paste 2 cells'))
    await act(() => harness.grid().redo())
    await waitFor(() => expect(status()).toHaveTextContent('Redid Paste 2 cells'))
  })

  it('builds every message from overridable labels', async () => {
    const harness = renderTally({
      columns,
      rows,
      props: {
        labels: {
          rows: (count) => `${count} Zeilen`,
          sorted: (sorts) => `Sortiert: ${sorts.map((sort) => sort.column).join()}`,
          undone: (action) => `Rückgängig: ${action}`,
        },
      },
    })
    await gridReady('One')
    act(() => harness.grid().view.setSort([{ column: 'mrr', direction: 'desc' }]))
    await waitFor(() => expect(status()).toHaveTextContent('Sortiert: MRR. 3 Zeilen'))
    await act(() => harness.grid().setCells([{ key: 1, column: 'mrr', value: 5 }]))
    await act(() => harness.grid().undo())
    await waitFor(() => expect(status()).toHaveTextContent('Rückgängig: Edit MRR'))
  })
})
