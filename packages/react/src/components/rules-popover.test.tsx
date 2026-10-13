import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { createArraySource, createSchema, type Grid } from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { useGrid } from '../hooks/use-grid.ts'
import { Tally } from './tally.tsx'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'health', label: 'Health', type: 'bar' }],
})

const rows = [
  { id: 1, name: 'One', health: 20 },
  { id: 2, name: 'Two', health: 80 },
  { id: 3, name: 'Three', health: 35 },
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

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('RulesPopover', () => {
  it('adds a rule from the column menu and tints matching cells', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    fireEvent.click(within(grid).getByRole('button', { name: 'Health options' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Formatting rules/ }))
    const popup = await screen.findByRole('dialog', { name: /Formatting rules/ })
    fireEvent.click(within(popup).getByRole('button', { name: 'Add rule' }))
    fireEvent.change(within(popup).getByRole('combobox', { name: 'Operator' }), {
      target: { value: 'lt' },
    })
    fireEvent.change(within(popup).getByRole('textbox', { name: 'Value' }), {
      target: { value: '40' },
    })
    fireEvent.click(within(popup).getByRole('radio', { name: 'amber' }))
    await settle()
    expect(current?.view.get().rules).toEqual([
      expect.objectContaining({
        column: 'health',
        op: 'lt',
        value: 40,
        style: { background: 'var(--tally-warn-soft)', color: 'var(--tally-warn-ink)' },
      }),
    ])
    const tinted = grid.querySelectorAll('.tally-cell[data-column="health"][data-rule]')
    expect([...tinted].map((cell) => cell.textContent)).toEqual(['20', '35'])
    fireEvent.click(within(popup).getByRole('button', { name: 'Remove rule' }))
    expect(current?.view.get().rules).toEqual([])
  })

  it('pins, copies and deletes rows from the context menu', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('One')
    const cellOf = (text: string): HTMLElement =>
      within(grid).getByText(text).closest<HTMLElement>('[data-row-index]')!
    fireEvent.contextMenu(cellOf('Two'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin row' }))
    await settle()
    expect(current?.view.get().pinnedRows).toEqual([2])
    expect(grid.querySelector('.tally-pinned-rows')).toHaveTextContent('Two')
    fireEvent.contextMenu(cellOf('Two'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('Two\t80')
    fireEvent.contextMenu(cellOf('Two'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete row' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this row?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete row' }))
    await settle()
    expect(current?.rows.rows().map((row) => row['id'])).toEqual([1, 3])
  })
})
