import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cellAt, gridReady, renderTally, settle } from '../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'mrr', label: 'MRR', type: 'number' },
  { id: 'site', label: 'Site', type: 'url', editable: false },
]

const rows = [
  { id: 1, name: 'One', mrr: 10, site: 'https://one.io' },
  { id: 2, name: 'Two', mrr: 20, site: 'https://two.io' },
  { id: 3, name: 'Three', mrr: 30, site: 'https://three.io' },
]

function clipboard(text = ''): {
  readonly writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>
} {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
  const readText = vi.fn<() => Promise<string>>().mockResolvedValue(text)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText },
    configurable: true,
  })
  return { writeText }
}

describe('keyboard intents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cuts the selected rows and clears their cells', async () => {
    const { writeText } = clipboard()
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    act(() => harness.grid().selection.dispatch({ type: 'selectRows', keys: [2] }))
    fireEvent.keyDown(grid, { key: 'x', ctrlKey: true })
    expect(writeText).toHaveBeenCalledWith('Two\t20.00\thttps://two.io')
    fireEvent.mouseDown(cellAt(0, 0))
    fireEvent.mouseDown(cellAt(0, 2), { shiftKey: true })
    fireEvent.keyDown(grid, { key: 'x', ctrlKey: true })
    await settle()
    expect(harness.grid().rows.byKey(1)).toMatchObject({
      name: null,
      mrr: null,
      site: 'https://one.io',
    })
  })

  it('skips copying an empty selection and pasting without an active cell', async () => {
    const { writeText } = clipboard('A')
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    fireEvent.keyDown(grid, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(grid, { key: 'x', ctrlKey: true })
    fireEvent.keyDown(grid, { key: 'v', ctrlKey: true })
    await settle()
    expect(writeText).not.toHaveBeenCalled()
    expect(harness.grid().rows.byKey(1)?.['name']).toBe('One')
  })

  it('pastes past the last row and into locked columns without writing them', async () => {
    clipboard('X\t5\tnope\r\nY\t6\t\r\nZ\t7\t')
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    fireEvent.mouseDown(cellAt(1, 0))
    fireEvent.keyDown(grid, { key: 'v', ctrlKey: true })
    await settle()
    await settle()
    expect(harness.grid().rows.byKey(2)).toMatchObject({
      name: 'X',
      mrr: 5,
      site: 'https://two.io',
    })
    expect(harness.grid().rows.byKey(3)).toMatchObject({ name: 'Y', mrr: 6 })
  })

  it('toggles rows with shift space, focuses the filter with slash and ignores inspect', async () => {
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    fireEvent.keyDown(grid, { key: ' ', shiftKey: true })
    expect(harness.grid().selection.get().rows.size).toBe(0)
    fireEvent.mouseDown(cellAt(1, 1))
    fireEvent.keyDown(grid, { key: ' ', shiftKey: true })
    expect([...harness.grid().selection.get().rows]).toEqual([2])
    fireEvent.keyDown(grid, { key: ' ' })
    fireEvent.keyDown(grid, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(grid, { key: 'Unidentified' })
    fireEvent.keyDown(grid, { key: '/' })
    expect(screen.getByRole('combobox', { name: 'Filter' })).toHaveFocus()
  })

  it('ignores keys from inner inputs and edits only editable cells', async () => {
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    fireEvent.mouseDown(cellAt(0, 2))
    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(within(grid).queryByRole('textbox')).toBeNull()
    fireEvent.doubleClick(cellAt(0, 2))
    expect(within(grid).queryByRole('textbox')).toBeNull()
    fireEvent.doubleClick(within(cellAt(1, 2)).getByRole('link'))
    fireEvent.doubleClick(grid)
    const checkbox = within(grid).getAllByRole('checkbox', { name: /Select row/ })[0]!
    fireEvent.keyDown(checkbox, { key: 'ArrowDown' })
    expect(harness.grid().selection.get().active).toEqual({ row: 0, column: 2 })
  })

  it('extends the selection by dragging and ignores clicks on links and other buttons', async () => {
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    fireEvent.mouseDown(cellAt(0, 0), { button: 2 })
    expect(harness.grid().selection.get().active).toBeUndefined()
    fireEvent.mouseDown(within(cellAt(0, 2)).getByRole('link'))
    expect(harness.grid().selection.get().active).toBeUndefined()
    fireEvent.mouseDown(grid)
    fireEvent.mouseOver(cellAt(1, 1))
    expect(harness.grid().selection.get().range).toBeUndefined()
    fireEvent.mouseDown(cellAt(0, 0))
    fireEvent.mouseOver(grid)
    fireEvent.mouseOver(cellAt(2, 1))
    fireEvent.mouseUp(window)
    fireEvent.mouseOver(cellAt(1, 0))
    expect(harness.grid().selection.get().range).toMatchObject({ focus: { row: 2, column: 1 } })
  })

  it('lets the host swallow intents and redo through the keyboard', async () => {
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    await act(() => harness.grid().setCells([{ key: 1, column: 'mrr', value: 11 }]))
    fireEvent.keyDown(grid, { key: 'z', ctrlKey: true })
    await settle()
    expect(harness.grid().rows.byKey(1)?.['mrr']).toBe(10)
    fireEvent.keyDown(grid, { key: 'y', ctrlKey: true })
    await settle()
    expect(harness.grid().rows.byKey(1)?.['mrr']).toBe(11)
  })

  it('starts fills only with a range', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    fireEvent.mouseDown(cellAt(0, 1))
    const handle = cellAt(0, 1).querySelector('[data-fill-handle]')
    if (handle !== null) {
      act(() => harness.grid().selection.dispatch({ type: 'clear' }))
      fireEvent.mouseDown(handle)
    }
    expect(harness.grid().rows.history()).toHaveLength(0)
  })
})

describe('tree rows', () => {
  it('expands and collapses with alt arrows and the expander button', async () => {
    const harness = renderTally({
      columns: [{ id: 'name', label: 'Name' }],
      parent: 'parent',
      rows: [
        { id: 1, name: 'Root', parent: null },
        { id: 2, name: 'Leaf', parent: 1 },
      ],
    })
    const grid = await gridReady('Root')
    expect(within(grid).queryByText('Leaf')).toBeNull()
    fireEvent.mouseDown(cellAt(0, 0))
    fireEvent.keyDown(grid, { key: 'ArrowRight', altKey: true })
    await within(grid).findByText('Leaf')
    expect(cellAt(1, 0).querySelector('.tally-expander:not(button)')).not.toBeNull()
    fireEvent.mouseDown(cellAt(1, 0))
    fireEvent.keyDown(grid, { key: 'ArrowRight', altKey: true })
    const expander = within(cellAt(0, 0)).getByRole('button', {
      name: 'Toggle row',
      expanded: true,
    })
    expect(expander).toHaveAttribute('tabindex', '-1')
    fireEvent.click(expander)
    await waitFor(() => expect(within(grid).queryByText('Leaf')).toBeNull())
    expect(harness.grid().view.get().expanded).toEqual([])
  })
})

describe('row menu', () => {
  it('pins and unpins every selected row and ignores clicks outside rows', async () => {
    const harness = renderTally({ columns, rows, source: { mutable: false } })
    const grid = await gridReady('One')
    act(() => harness.grid().selection.dispatch({ type: 'selectRows', keys: [1, 2] }))
    fireEvent.contextMenu(cellAt(0, 0))
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).toBeNull()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin 2 rows' }))
    await settle()
    expect(harness.grid().view.get().pinnedRows).toEqual([1, 2])
    fireEvent.contextMenu(grid.querySelector('.tally-pinned-rows [role="gridcell"]')!)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unpin 2 rows' }))
    await settle()
    expect(harness.grid().view.get().pinnedRows).toEqual([])
    fireEvent.contextMenu(grid.querySelector('.tally-footer')!)
    await settle()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('cancels a multi row delete', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() => harness.grid().selection.dispatch({ type: 'selectRows', keys: [1, 3] }))
    fireEvent.contextMenu(cellAt(2, 0))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete 2 rows' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 rows?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(screen.getByRole('grid')).toHaveFocus())
    expect(harness.grid().rows.rows()).toHaveLength(3)
  })
})
