import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { createArraySource, createSchema, type Grid } from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { useGrid } from '../hooks/use-grid.ts'
import { Tally } from './tally.tsx'

const schema = createSchema({
  columns: [
    { id: 'name' },
    { id: 'mrr', type: 'currency' },
    { id: 'plan', type: 'enum', options: [{ value: 'pro', label: 'Pro' }, { value: 'team' }] },
    { id: 'paid', type: 'bool' },
    { id: 'locked', editable: false },
  ],
})

const rows = [
  { id: 1, name: 'One', mrr: 10, plan: 'pro', paid: false, locked: 'a' },
  { id: 2, name: 'Two', mrr: 20, plan: 'team', paid: true, locked: 'b' },
  { id: 3, name: 'Three', mrr: 30, plan: 'pro', paid: false, locked: 'c' },
  { id: 4, name: 'Four', mrr: 40, plan: 'team', paid: false, locked: 'd' },
]

let current: Grid | undefined

function Remember({ grid }: { readonly grid: Grid }): ReactNode {
  useEffect(() => {
    current = grid
  }, [grid])
  return null
}

function Harness(): ReactNode {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({ schema, source })
  return (
    <Tally grid={grid} initialSize={{ width: 1200, height: 600 }}>
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

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('editing', () => {
  it('opens a text editor on Enter, commits with Enter and moves down', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 1))
    fireEvent.keyDown(grid, { key: 'Enter' })
    const input = within(cell(0, 1)).getByRole('textbox')
    expect(input).toHaveValue('10')
    fireEvent.change(input, { target: { value: '1.5k' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(current?.rows.byKey(1)?.['mrr']).toBe(1500)
    expect(cell(1, 1)).toHaveAttribute('data-active')
    expect(within(grid).queryByRole('textbox')).toBeNull()
  })

  it('starts editing from a typed character and cancels with Escape', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(2, 0))
    fireEvent.keyDown(grid, { key: 'x' })
    const input = within(cell(2, 0)).getByRole('textbox')
    expect(input).toHaveValue('x')
    fireEvent.keyDown(input, { key: 'Escape' })
    await settle()
    expect(current?.rows.byKey(3)?.['name']).toBe('Three')
    expect(within(grid).queryByRole('textbox')).toBeNull()
  })

  it('toggles booleans, refuses locked columns and double-click opens the editor', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 3))
    fireEvent.keyDown(grid, { key: 'Enter' })
    await settle()
    expect(current?.rows.byKey(1)?.['paid']).toBe(true)
    fireEvent.mouseDown(cell(0, 4))
    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(within(grid).queryByRole('textbox')).toBeNull()
    fireEvent.doubleClick(cell(1, 0))
    expect(within(cell(1, 0)).getByRole('textbox')).toHaveValue('Two')
  })

  it('opens the enum combobox with its options and cancels with Escape', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 2))
    fireEvent.keyDown(grid, { key: 'Enter' })
    const combobox = await within(cell(0, 2)).findByRole('combobox')
    expect(combobox).toHaveFocus()
    expect(await screen.findByRole('option', { name: 'Pro' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'team' })).toBeInTheDocument()
    fireEvent.keyDown(combobox, { key: 'Escape' })
    await settle()
    expect(within(cell(0, 2)).queryByRole('combobox')).toBeNull()
    expect(current?.rows.byKey(1)?.['plan']).toBe('pro')
  })

  it('fills down a numeric series with the fill handle in one mutation', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(0, 1))
    fireEvent.mouseDown(cell(1, 1), { shiftKey: true })
    const handle = cell(1, 1).querySelector('[data-fill-handle]')
    expect(handle).not.toBeNull()
    fireEvent.mouseDown(handle!)
    fireEvent.mouseOver(cell(3, 1))
    expect(cell(2, 1)).toHaveAttribute('data-fill')
    expect(cell(3, 1)).toHaveAttribute('data-fill')
    fireEvent.mouseUp(window)
    await settle()
    expect(current?.rows.rows().map((row) => row['mrr'])).toEqual([10, 20, 30, 40])
    expect(current?.rows.history()).toHaveLength(0)
    fireEvent.mouseDown(cell(0, 1))
    fireEvent.keyDown(grid, { key: 'Enter' })
    fireEvent.change(within(cell(0, 1)).getByRole('textbox'), { target: { value: '100' } })
    fireEvent.keyDown(within(cell(0, 1)).getByRole('textbox'), { key: 'Tab' })
    await settle()
    fireEvent.mouseDown(cell(0, 1))
    fireEvent.mouseDown(cell(1, 1), { shiftKey: true })
    fireEvent.mouseDown(cell(1, 1).querySelector('[data-fill-handle]')!)
    fireEvent.mouseOver(cell(3, 1))
    fireEvent.mouseUp(window)
    await settle()
    expect(current?.rows.rows().map((row) => row['mrr'])).toEqual([100, 20, -60, -140])
    expect(current?.rows.history()).toHaveLength(2)
    expect(cell(3, 1)).toHaveAttribute('data-range')
  })

  it('pastes tab separated text from the active cell', async () => {
    const readText = vi.fn<() => Promise<string>>().mockResolvedValue('A\t5\nB\t6\n')
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText, writeText: vi.fn<(text: string) => Promise<void>>() },
      configurable: true,
    })
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.mouseDown(cell(2, 0))
    fireEvent.keyDown(grid, { key: 'v', ctrlKey: true })
    await settle()
    await settle()
    expect(current?.rows.byKey(3)).toMatchObject({ name: 'A', mrr: 5 })
    expect(current?.rows.byKey(4)).toMatchObject({ name: 'B', mrr: 6 })
    expect(cell(3, 1)).toHaveAttribute('data-range')
  })
})
