import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { gridReady, renderTally, settle } from '../../test/harness.tsx'
import type { AddColumnHandler } from './ai-menu.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'mrr', label: 'MRR', type: 'currency' },
  { id: 'region', label: 'Region', pin: 'left' as const },
]

const rows = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `Account ${index + 1}`,
  mrr: (index + 1) * 10,
  region: index % 2 === 0 ? 'EU' : 'US',
}))

describe('AiMenu', () => {
  it('adds a column from a suggestion and marks it as entering', async () => {
    const addColumn = vi.fn<AddColumnHandler>(async (_prompt, grid) => {
      grid.view.update((view) => view)
      return 'mrr'
    })
    renderTally({ columns, rows, props: { ai: { addColumn, suggestions: ['Score fit'] } } })
    await gridReady('Account 1')
    fireEvent.click(screen.getByRole('button', { name: 'Add an AI column' }))
    const popup = await screen.findByRole('dialog', { name: 'Add an AI column' })
    const add = within(popup).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()
    fireEvent.click(within(popup).getByRole('button', { name: 'Score fit' }))
    const input = within(popup).getByRole('textbox', { name: 'Add an AI column' })
    expect(input).toHaveValue('Score fit')
    expect(popup.querySelector('.tally-ai-suggestions')).toHaveAttribute('data-dim')
    fireEvent.submit(input.closest('form')!)
    await settle()
    expect(addColumn).toHaveBeenCalledWith('Score fit', expect.anything())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.querySelector('.tally-header-cell[data-column="mrr"]')).toHaveAttribute(
      'data-entering',
    )
  })

  it('shows the failure and ignores blank prompts', async () => {
    const addColumn = vi
      .fn<AddColumnHandler>()
      .mockRejectedValueOnce(new Error('Model offline'))
      .mockRejectedValueOnce('plain failure')
    renderTally({ columns, rows, props: { ai: { addColumn } } })
    await gridReady('Account 1')
    fireEvent.click(screen.getByRole('button', { name: 'Add an AI column' }))
    const popup = await screen.findByRole('dialog', { name: 'Add an AI column' })
    expect(popup.querySelector('.tally-ai-suggestions')).toBeNull()
    const input = within(popup).getByRole('textbox', { name: 'Add an AI column' })
    fireEvent.submit(input.closest('form')!)
    expect(addColumn).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'churn risk' } })
    fireEvent.submit(input.closest('form')!)
    expect(await within(popup).findByRole('alert')).toHaveTextContent('Model offline')
    fireEvent.change(input, { target: { value: 'churn risk!' } })
    expect(within(popup).queryByRole('alert')).toBeNull()
    fireEvent.submit(input.closest('form')!)
    expect(await within(popup).findByRole('alert')).toHaveTextContent('plain failure')
  })
})

describe('DisplayMenu', () => {
  it('changes density, hides and pins columns', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('Account 1')
    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    const popup = await screen.findByRole('dialog', { name: 'Display' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'Spacious' }))
    expect(harness.grid().view.get().density).toBe('spacious')
    expect(document.querySelector('.tally')).toHaveAttribute('data-density', 'spacious')
    fireEvent.click(within(popup).getByRole('switch', { name: 'MRR' }))
    expect(
      harness
        .grid()
        .view.get()
        .columns.find((column) => column.id === 'mrr')?.hidden,
    ).toBe(true)
    fireEvent.click(within(popup).getByRole('button', { name: 'Pin left: Name' }))
    expect(
      harness
        .grid()
        .view.get()
        .columns.find((column) => column.id === 'name')?.pin,
    ).toBe('left')
    fireEvent.click(within(popup).getByRole('button', { name: 'Unpin: Region' }))
    expect(
      harness
        .grid()
        .view.get()
        .columns.find((column) => column.id === 'region')?.pin,
    ).toBeUndefined()
  })
})

describe('Toolbar', () => {
  it('undoes and redoes edits with labelled buttons', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('Account 1')
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    await act(() => harness.grid().setCells([{ key: 1, column: 'mrr', value: 99 }], 'Edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Undo Edit MRR' }))
    await settle()
    expect(harness.grid().rows.byKey(1)?.['mrr']).toBe(10)
    fireEvent.click(screen.getByRole('button', { name: 'Redo Edit MRR' }))
    await settle()
    expect(harness.grid().rows.byKey(1)?.['mrr']).toBe(99)
  })

  it('hides undo for read only sources and counts the selection', async () => {
    const harness = renderTally({ columns, rows, source: { mutable: false } })
    await gridReady('Account 1')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(screen.getByText('5 rows')).toBeInTheDocument()
    act(() => harness.grid().selection.dispatch({ type: 'selectRows', keys: [1, 2] }))
    expect(await screen.findByText('2 selected')).toBeInTheDocument()
  })

  it('pages offset sources and reports the visible range', async () => {
    const harness = renderTally({ columns, rows, source: { pagination: 'offset' }, pageSize: 2 })
    await gridReady('Account 1')
    const pager = screen.getByRole('navigation', { name: 'Pages' })
    const previous = within(pager).getByRole('button', { name: 'Previous page' })
    expect(previous).toBeDisabled()
    expect(screen.getByText(/1–\d+ of 5/)).toBeInTheDocument()
    fireEvent.click(within(pager).getByRole('button', { name: 'Next page' }))
    await settle()
    expect(harness.grid().get().page.index).toBe(1)
    fireEvent.click(within(pager).getByRole('button', { name: 'Previous page' }))
    await settle()
    expect(harness.grid().get().page.index).toBe(0)
  })

  it('reports group ranges when an offset source is grouped', async () => {
    const harness = renderTally({ columns, rows, source: { pagination: 'offset' } })
    await gridReady('Account 1')
    act(() => harness.grid().view.setGroup('region'))
    await settle()
    expect(await screen.findByText(/of 2 groups/)).toBeInTheDocument()
  })

  it('accepts a custom toolbar or none at all', async () => {
    renderTally({ columns, rows, props: { toolbar: <div role="toolbar">Mine</div> } })
    await gridReady('Account 1')
    expect(screen.getByRole('toolbar')).toHaveTextContent('Mine')
    expect(screen.queryByRole('combobox', { name: 'Filter' })).toBeNull()
  })

  it('renders children without a toolbar when it is disabled', async () => {
    renderTally({ columns, rows, props: { toolbar: false, children: <p>Footnote</p> } })
    await gridReady('Account 1')
    expect(screen.getByText('Footnote')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Display' })).toBeNull()
  })
})
