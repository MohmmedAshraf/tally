import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { createArraySource, createSchema, type Grid } from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { useGrid } from '../../hooks/use-grid.ts'
import { Tally, type TallyProps } from '../tally.tsx'

const schema = createSchema({
  columns: [
    { id: 'name' },
    {
      id: 'plan',
      label: 'Plan',
      type: 'enum',
      options: [
        { value: 'pro', label: 'Pro' },
        { value: 'team', label: 'Team' },
      ],
    },
    { id: 'mrr', label: 'MRR', type: 'currency' },
  ],
})

const rows = [
  { id: 1, name: 'One', plan: 'pro', mrr: 10 },
  { id: 2, name: 'Two', plan: 'team', mrr: 20 },
  { id: 3, name: 'Three', plan: 'team', mrr: 30 },
]

let current: Grid | undefined

function Remember({ grid }: { readonly grid: Grid }): ReactNode {
  useEffect(() => {
    current = grid
  }, [grid])
  return null
}

function Harness(props: Pick<TallyProps, 'ask' | 'labels'>): ReactNode {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({ schema, source })
  return (
    <Tally grid={grid} initialSize={{ width: 1200, height: 600 }} {...props}>
      <Remember grid={grid} />
    </Tally>
  )
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('FilterBar', () => {
  it('applies typed queries as chips and removes them', async () => {
    render(<Harness />)
    await screen.findByText('One')
    const input = screen.getByRole('combobox', { name: 'Filter' })
    fireEvent.change(input, { target: { value: 'plan is team sort by mrr desc' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(current?.view.get().filter).toEqual({
      type: 'condition',
      column: 'plan',
      op: 'eq',
      value: 'team',
    })
    expect(current?.view.get().sort).toEqual([{ column: 'mrr', direction: 'desc' }])
    const chip = screen.getByTitle('plan is team')
    expect(chip).toHaveTextContent('PlanisTeam')
    expect(input).toHaveValue('')
    await screen.findByText('2 rows')
    expect(screen.queryByText('One')).toBeNull()
    fireEvent.change(input, { target: { value: 'mrr > 25' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(current?.view.get().filter?.type).toBe('and')
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Remove plan is team' }))
    expect(current?.view.get().filter).toMatchObject({ column: 'mrr', op: 'gt' })
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(current?.view.get().filter).toBeUndefined()
  })

  it('keeps invalid text and marks the field', async () => {
    render(<Harness />)
    await screen.findByText('One')
    const input = screen.getByRole('combobox', { name: 'Filter' })
    fireEvent.change(input, { target: { value: 'mrr >' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveValue('mrr >')
    expect(current?.view.get().filter).toBeUndefined()
  })

  it('offers suggestions that complete the text', async () => {
    render(<Harness />)
    await screen.findByText('One')
    const input = screen.getByRole('combobox', { name: 'Filter' })
    fireEvent.change(input, { target: { value: 'plan is' } })
    const option = await screen.findByRole('option', { name: /Team/ })
    expect(option).toBeInTheDocument()
  })

  it('runs ask mode through the handler and applies on confirm', async () => {
    const ask = vi.fn<TallyProps['ask'] & object>().mockResolvedValue({
      query: { filter: { type: 'condition', column: 'mrr', op: 'gte', value: 20 }, sort: [] },
      explanation: 'Accounts at or above twenty',
    })
    render(<Harness ask={ask} />)
    await screen.findByText('One')
    const input = screen.getByRole('combobox', { name: 'Filter' })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    fireEvent.change(input, { target: { value: 'big accounts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(ask).toHaveBeenCalledWith('big accounts', current)
    const panel = await screen.findByRole('dialog', { name: 'Ask' })
    expect(panel).toHaveTextContent('Accounts at or above twenty')
    expect(within(panel).getByTitle('mrr >= 20')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Apply' }))
    await settle()
    expect(current?.view.get().filter).toMatchObject({ column: 'mrr', op: 'gte', value: 20 })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('uses custom labels', async () => {
    render(
      <Harness labels={{ rows: (count) => `${count} accounts`, filterPlaceholder: 'Search' }} />,
    )
    await screen.findByText('3 accounts')
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
  })
})
