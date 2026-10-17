import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { createArraySource, createSchema, type Grid, type GridIntent } from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { useGrid } from '../hooks/use-grid.ts'
import { Tally } from './tally.tsx'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }, { id: 'seats', type: 'int' }],
})

const rows = [
  { id: 1, name: 'One', mrr: 10, seats: 1 },
  { id: 2, name: 'Two', mrr: 20, seats: 2 },
  { id: 3, name: 'Three', mrr: 30, seats: 3 },
]

let current: Grid | undefined

function Remember({ grid }: { readonly grid: Grid }): ReactNode {
  useEffect(() => {
    current = grid
  }, [grid])
  return null
}

function Harness({ onIntent }: { readonly onIntent?: (intent: GridIntent) => boolean }): ReactNode {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({ schema, source })
  return (
    <Tally grid={grid} initialSize={{ width: 1200, height: 600 }} onIntent={onIntent}>
      <Remember grid={grid} />
    </Tally>
  )
}

function cell(row: number, column: number): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-row-index="${row}"][data-col-index="${column}"]`,
  )
  if (element === null) throw new Error(`missing cell ${row}:${column}`)
  return element
}

describe('interactions', () => {
  it('focuses cells with the mouse and extends with shift and keyboard', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 0))
    expect(cell(0, 0)).toHaveAttribute('data-active')
    expect(grid).toHaveAttribute('aria-activedescendant', cell(0, 0).id)
    fireEvent.mouseDown(cell(1, 1), { shiftKey: true })
    expect(cell(0, 0)).toHaveAttribute('data-active')
    expect(cell(1, 1)).toHaveAttribute('data-range')
    expect(cell(0, 1)).toHaveAttribute('aria-selected', 'true')
    expect(cell(2, 2)).not.toHaveAttribute('data-range')
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(cell(1, 0)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true })
    expect(cell(1, 1)).toHaveAttribute('data-range')
    fireEvent.keyDown(grid, { key: 'Escape' })
    expect(document.querySelector('[data-active]')).toBeNull()
  })

  it('selects rows through the gutter and the header checkbox', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    const boxes = within(grid).getAllByRole('checkbox', { name: /Select row/ })
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[2]!, { shiftKey: true })
    const selected = within(grid)
      .getAllByRole('row')
      .filter((row) => row.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(3)
    const all = within(grid).getByRole('checkbox', { name: 'Select all rows' })
    expect(all).toBeChecked()
    fireEvent.click(all)
    expect(current?.selection.get().rows.size).toBe(0)
    fireEvent.click(all)
    expect(current?.selection.get().rows.size).toBe(3)
  })

  it('copies the range as tsv, clears cells and lets the host intercept intents', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onIntent = vi.fn<(intent: GridIntent) => boolean>((intent) => intent.type === 'undo')
    render(<Harness onIntent={onIntent} />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 0))
    fireEvent.mouseDown(cell(1, 1), { shiftKey: true })
    fireEvent.keyDown(grid, { key: 'c', ctrlKey: true })
    expect(writeText).toHaveBeenCalledWith('One\t$10.00\nTwo\t$20.00')
    await act(async () => {
      fireEvent.keyDown(grid, { key: 'Delete' })
      await Promise.resolve()
    })
    expect(current?.rows.byKey(1)?.['mrr']).toBeNull()
    expect(current?.rows.byKey(2)?.['name']).toBeNull()
    expect(current?.rows.byKey(3)?.['name']).toBe('Three')
    fireEvent.keyDown(grid, { key: 'z', ctrlKey: true })
    expect(onIntent).toHaveBeenLastCalledWith({ type: 'undo' })
    expect(current?.rows.byKey(1)?.['mrr']).toBeNull()
  })

  it('keeps one tab stop, moves with Tab inside a row and lets Tab leave at the edges', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    expect(fireEvent.keyDown(grid, { key: 'Tab' })).toBe(true)
    expect(document.querySelector('[data-active]')).toBeNull()
    fireEvent.mouseDown(cell(1, 0))
    expect(fireEvent.keyDown(grid, { key: 'Tab', shiftKey: true })).toBe(true)
    expect(fireEvent.keyDown(grid, { key: 'Tab' })).toBe(false)
    expect(cell(1, 1)).toHaveAttribute('data-active')
    expect(fireEvent.keyDown(grid, { key: 'Tab' })).toBe(false)
    expect(cell(1, 2)).toHaveAttribute('data-active')
    expect(fireEvent.keyDown(grid, { key: 'Tab' })).toBe(true)
    expect(cell(1, 2)).toHaveAttribute('data-active')
    for (const box of within(grid).getAllByRole('checkbox', { name: /^Select row \d$/ })) {
      expect(box).toHaveAttribute('tabindex', '-1')
    }
  })

  it('navigates with Home, End, paging keys and Ctrl+Home/End', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(1, 1))
    fireEvent.keyDown(grid, { key: 'End' })
    expect(cell(1, 2)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: 'Home' })
    expect(cell(1, 0)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: 'PageDown' })
    expect(cell(2, 0)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: 'PageUp' })
    expect(cell(0, 0)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: 'End', ctrlKey: true })
    expect(cell(2, 2)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true })
    expect(cell(0, 0)).toHaveAttribute('data-active')
    fireEvent.keyDown(grid, { key: ' ', shiftKey: true })
    expect(current?.selection.get().rows.has(1)).toBe(true)
    expect(within(grid).getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('activates the first cell when focus arrives from the keyboard', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    act(() => grid.focus())
    expect(cell(0, 0)).toHaveAttribute('data-active')
    expect(grid).toHaveAttribute('aria-activedescendant', cell(0, 0).id)
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    act(() => grid.blur())
    act(() => grid.focus())
    expect(cell(1, 0)).toHaveAttribute('data-active')
  })

  it('leaves keys pressed on controls inside the grid to those controls', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 0))
    const sort = within(grid).getByRole('button', { name: 'name' })
    expect(fireEvent.keyDown(sort, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(sort, { key: ' ' })).toBe(true)
    expect(fireEvent.keyDown(sort, { key: 'Tab' })).toBe(true)
    expect(fireEvent.keyDown(sort, { key: 'ArrowDown' })).toBe(true)
    expect(cell(0, 0)).toHaveAttribute('data-active')
  })
})
