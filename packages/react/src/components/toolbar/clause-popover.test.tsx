import { act, fireEvent, screen, within } from '@testing-library/react'
import { condition, type Filter } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { gridReady, renderTally, settle, type Harness } from '../../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  {
    id: 'plan',
    label: 'Plan',
    type: 'enum',
    options: [
      { value: 'pro', label: 'Pro', color: 'blue' },
      { value: 'team', label: 'Team' },
      { value: 'free', label: 'Free' },
    ],
  },
  { id: 'paid', label: 'Paid', type: 'bool' },
  { id: 'mrr', label: 'MRR', type: 'number' },
  { id: 'renewal', label: 'Renewal', type: 'date' },
]

const rows = [
  { id: 1, name: 'One', plan: 'pro', paid: true, mrr: 10, renewal: '2026-01-10' },
  { id: 2, name: 'Two', plan: 'team', paid: false, mrr: 20, renewal: '2026-02-10' },
  { id: 3, name: 'Three', plan: 'team', paid: true, mrr: 80, renewal: '2026-03-10' },
]

async function openClause(
  filter: Filter,
  title: string,
): Promise<{
  readonly harness: Harness
  readonly popup: HTMLElement
}> {
  const harness = renderTally({ columns, rows })
  await gridReady('One')
  act(() => harness.grid().view.setFilter(filter))
  await settle()
  const chip = document.querySelector<HTMLElement>('.tally-chip .tally-chip-label')
  if (chip === null) throw new Error('missing chip')
  fireEvent.click(chip)
  const popup = await screen.findByRole('dialog', { name: title })
  return { harness, popup }
}

describe('ClausePopover', () => {
  it('edits enum clauses through checkboxes and the negation toggle', async () => {
    const { harness, popup } = await openClause(condition('plan', 'eq', 'pro'), 'Plan')
    const filter = (): Filter | undefined => harness.grid().view.get().filter
    expect(popup.querySelectorAll('.tally-option-count').length).toBeGreaterThan(0)
    expect(popup.querySelector('.tally-dot')).toHaveStyle({ background: 'blue' })
    fireEvent.click(within(popup).getByRole('checkbox', { name: /Team/ }))
    expect(filter()).toMatchObject({ op: 'in', value: ['pro', 'team'] })
    fireEvent.click(within(popup).getByRole('radio', { name: 'is not' }))
    expect(filter()).toMatchObject({ op: 'notIn', value: ['pro', 'team'] })
    fireEvent.click(within(popup).getByRole('checkbox', { name: /Pro/ }))
    expect(filter()).toMatchObject({ op: 'neq', value: 'team' })
    fireEvent.click(within(popup).getByRole('checkbox', { name: /Team/ }))
    expect(filter()).toMatchObject({ op: 'notEmpty' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'is' }))
    expect(filter()).toMatchObject({ op: 'empty' })
  })

  it('edits booleans with the same option list', async () => {
    const { harness, popup } = await openClause(condition('paid', 'eq', true), 'Paid')
    fireEvent.click(within(popup).getByRole('radio', { name: 'is not' }))
    expect(harness.grid().view.get().filter).toMatchObject({ column: 'paid', op: 'neq' })
  })

  it('edits number clauses with operators, ranges and histogram bins', async () => {
    const { harness, popup } = await openClause(condition('mrr', 'gt', 15), 'MRR')
    const filter = (): Filter | undefined => harness.grid().view.get().filter
    const from = within(popup).getByRole('textbox')
    expect(from).toHaveValue('15')
    fireEvent.change(from, { target: { value: '25' } })
    expect(filter()).toMatchObject({ op: 'gt', value: 25 })
    fireEvent.change(within(popup).getByRole('textbox'), { target: { value: '' } })
    expect(filter()).toMatchObject({ op: 'gt' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'between' }))
    expect(filter()).toMatchObject({ op: 'between' })
    const [low, high] = within(popup).getAllByRole('textbox')
    fireEvent.change(low!, { target: { value: '5' } })
    fireEvent.change(within(popup).getAllByRole('textbox')[1]!, { target: { value: '50' } })
    expect(filter()).toMatchObject({ op: 'between', value: [5, 50] })
    expect(high).toBeDefined()
    const bars = popup.querySelectorAll<HTMLElement>('.tally-histogram-bar')
    expect(bars.length).toBeGreaterThan(0)
    expect(popup.querySelectorAll('.tally-histogram-bar[data-in]').length).toBeGreaterThan(0)
    fireEvent.click(bars[0]!)
    expect(filter()).toMatchObject({ op: 'between' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'is' }))
    expect(filter()).toMatchObject({ op: 'eq' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'is empty' }))
    expect(filter()).toMatchObject({ op: 'empty' })
    expect(within(popup).queryByRole('textbox')).toBeNull()
  })

  it('marks histogram bins for lower bounds and exact values', async () => {
    const { harness, popup } = await openClause(condition('mrr', 'lte', 30), 'MRR')
    expect(popup.querySelectorAll('.tally-histogram-bar[data-in]').length).toBeGreaterThan(0)
    act(() => harness.grid().view.setFilter(condition('mrr', 'eq', 20)))
    await settle()
    expect(popup.querySelectorAll('.tally-histogram-bar[data-in]')).toHaveLength(1)
  })

  it('edits date clauses with relative presets', async () => {
    const { harness, popup } = await openClause(condition('renewal', 'gt', '2026-01-01'), 'Renewal')
    const filter = (): Filter | undefined => harness.grid().view.get().filter
    expect(within(popup).getByLabelText('>')).toHaveAttribute('type', 'date')
    fireEvent.click(within(popup).getByRole('radio', { name: 'in' }))
    expect(filter()).toMatchObject({ op: 'within', value: { amount: 30, unit: 'day' } })
    const presets = popup.querySelectorAll<HTMLElement>('.tally-preset')
    expect(
      [...presets].filter((preset) => preset.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(1)
    fireEvent.click(presets[0]!)
    expect(filter()).toMatchObject({ op: 'within', value: { amount: 7 } })
  })

  it('edits text clauses and drops the value for empty checks', async () => {
    const { harness, popup } = await openClause(condition('name', 'contains', 'on'), 'Name')
    const filter = (): Filter | undefined => harness.grid().view.get().filter
    fireEvent.change(within(popup).getByRole('textbox'), { target: { value: 'tw' } })
    expect(filter()).toMatchObject({ op: 'contains', value: 'tw' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'starts with' }))
    expect(filter()).toMatchObject({ op: 'startsWith', value: 'tw' })
    fireEvent.click(within(popup).getByRole('radio', { name: 'is empty' }))
    expect(filter()).toMatchObject({ op: 'empty' })
    expect(within(popup).queryByRole('textbox')).toBeNull()
  })

  it('falls back to a raw query editor for compound clauses', async () => {
    const { harness, popup } = await openClause(
      { type: 'or', filters: [condition('mrr', 'gt', 50), condition('mrr', 'lt', 15)] },
      'mrr > 50 or mrr < 15',
    )
    const input = within(popup).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'mrr >' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.change(input, { target: { value: 'mrr > 70' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(harness.grid().view.get().filter).toMatchObject({ column: 'mrr', op: 'gt', value: 70 })
  })
})
