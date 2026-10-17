import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cellAt, gridReady, renderTally, settle, type Harness } from '../../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'notes', label: 'Notes', wrap: true },
  { id: 'renewal', label: 'Renewal', type: 'date' },
  {
    id: 'plan',
    label: 'Plan',
    type: 'enum',
    options: [
      { value: 'pro', label: 'Pro', color: 'blue' },
      { value: 'team', label: 'Team' },
    ],
  },
  { id: 'mrr', label: 'MRR', type: 'number' },
]

const rows = [
  { id: 1, name: 'One', notes: 'first', renewal: '2026-01-01', plan: 'pro', mrr: 1 },
  { id: 2, name: 'Two', notes: null, renewal: null, plan: null, mrr: 2 },
  { id: 3, name: 'Three', notes: 'third', renewal: '2026-03-01', plan: 'team', mrr: 3 },
]

async function edit(
  row: number,
  column: number,
): Promise<{ readonly harness: Harness; readonly grid: HTMLElement }> {
  const harness = renderTally({ columns, rows })
  const grid = await gridReady('One')
  fireEvent.mouseDown(cellAt(row, column))
  fireEvent.keyDown(grid, { key: 'Enter' })
  return { harness, grid }
}

function value(harness: Harness, key: number, column: string): unknown {
  return harness.grid().rows.byKey(key)?.[column]
}

describe('text editor', () => {
  it('uses a textarea for wrapped columns and keeps alt enter as a newline', async () => {
    const { harness } = await edit(0, 1)
    const area = within(cellAt(0, 1)).getByRole('textbox')
    expect(area.tagName).toBe('TEXTAREA')
    fireEvent.change(area, { target: { value: 'line' } })
    fireEvent.keyDown(area, { key: 'Enter', altKey: true })
    expect(within(cellAt(0, 1)).getByRole('textbox')).toBeInTheDocument()
    fireEvent.keyDown(area, { key: 'a' })
    fireEvent.keyDown(area, { key: 'Enter', shiftKey: true })
    await settle()
    expect(value(harness, 1, 'notes')).toBe('line')
  })

  it('commits on blur, clears blank text and rejects unparseable numbers', async () => {
    const { harness, grid } = await edit(1, 0)
    const input = within(cellAt(1, 0)).getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    fireEvent.blur(input)
    await settle()
    expect(value(harness, 2, 'name')).toBeNull()
    fireEvent.mouseDown(cellAt(1, 4))
    fireEvent.keyDown(grid, { key: 'Enter' })
    const number = within(cellAt(1, 4)).getByRole('textbox')
    expect(number).toHaveAttribute('inputmode', 'decimal')
    fireEvent.change(number, { target: { value: 'abc' } })
    fireEvent.keyDown(number, { key: 'Tab', shiftKey: true })
    await settle()
    expect(value(harness, 2, 'mrr')).toBe(2)
  })
})

describe('date editor', () => {
  it('commits with Enter, cancels with Escape and clears on blur', async () => {
    const { harness, grid } = await edit(0, 2)
    const input = within(cellAt(0, 2)).getByLabelText('Renewal')
    expect(input).toHaveAttribute('type', 'date')
    fireEvent.change(input, { target: { value: '2027-02-02' } })
    fireEvent.keyDown(input, { key: 'x' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(value(harness, 1, 'renewal')).toBe('2027-02-02')
    fireEvent.mouseDown(cellAt(2, 2))
    fireEvent.keyDown(grid, { key: 'Enter' })
    const next = within(cellAt(2, 2)).getByLabelText('Renewal')
    fireEvent.keyDown(next, { key: 'Escape' })
    await settle()
    expect(value(harness, 3, 'renewal')).toBe('2026-03-01')
    fireEvent.mouseDown(cellAt(2, 2))
    fireEvent.keyDown(grid, { key: 'Enter' })
    const third = within(cellAt(2, 2)).getByLabelText('Renewal')
    fireEvent.change(third, { target: { value: '' } })
    fireEvent.blur(third)
    await settle()
    expect(value(harness, 3, 'renewal')).toBeNull()
    fireEvent.mouseDown(cellAt(1, 2))
    fireEvent.keyDown(grid, { key: 'Enter' })
    const empty = within(cellAt(1, 2)).getByLabelText('Renewal')
    fireEvent.keyDown(empty, { key: 'Tab' })
    await settle()
    expect(value(harness, 2, 'renewal')).toBeNull()
  })
})

describe('enum editor', () => {
  it('commits a picked option and moves down', async () => {
    const { harness } = await edit(1, 3)
    const combobox = await within(cellAt(1, 3)).findByRole('combobox')
    expect(combobox).not.toHaveAttribute('placeholder')
    fireEvent.click(await screen.findByRole('option', { name: 'Team' }))
    await settle()
    expect(value(harness, 2, 'plan')).toBe('team')
    await waitFor(() => expect(cellAt(2, 3)).toHaveAttribute('data-active'))
  })

  it('commits the current value with Tab', async () => {
    const { harness } = await edit(0, 3)
    const combobox = await within(cellAt(0, 3)).findByRole('combobox')
    expect(combobox).toHaveAttribute('placeholder', 'Pro')
    expect(document.querySelector('.tally-popup .tally-dot')).toHaveStyle({ background: 'blue' })
    fireEvent.keyDown(combobox, { key: 'a' })
    fireEvent.keyDown(combobox, { key: 'Tab', shiftKey: true })
    await settle()
    expect(value(harness, 1, 'plan')).toBe('pro')
    expect(within(cellAt(0, 3)).queryByRole('combobox')).toBeNull()
  })
})
