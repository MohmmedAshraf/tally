import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gridReady, renderTally, settle, type Harness } from '../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name', width: 120 },
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
  { id: 'locked', label: 'Locked', sortable: false, groupable: false, filterable: false },
]

const rows = [
  { id: 1, name: 'One', plan: 'pro', mrr: 10, locked: 'a' },
  { id: 2, name: 'Two', plan: 'team', mrr: 30, locked: 'b' },
  { id: 3, name: 'Three', plan: 'team', mrr: 20, locked: 'c' },
]

async function openMenu(harness: Harness, label: string): Promise<HTMLElement> {
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  await waitFor(() => expect(harness.grid().get().status).toBe('ready'))
  const trigger = document.querySelector<HTMLElement>(`[aria-label="${label} options"]`)
  if (trigger === null) throw new Error(`missing ${label} menu`)
  fireEvent.click(trigger)
  return screen.findByRole('menu')
}

function columnState(harness: Harness, id: string) {
  return harness
    .grid()
    .view.get()
    .columns.find((column) => column.id === id)
}

describe('HeaderMenu', () => {
  it('sorts numeric columns high to low and adds secondary sorts', async () => {
    const harness = renderTally({ columns, rows })
    const menu = await openMenu(harness, 'MRR')
    expect(within(menu).getByText('Currency')).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sort high to low' }))
    expect(harness.grid().view.get().sort).toEqual([{ column: 'mrr', direction: 'desc' }])
    const again = await openMenu(harness, 'MRR')
    fireEvent.click(within(again).getByRole('menuitem', { name: 'Sort low to high' }))
    expect(harness.grid().view.get().sort).toEqual([{ column: 'mrr', direction: 'asc' }])
    const name = await openMenu(harness, 'Name')
    fireEvent.click(within(name).getByRole('menuitem', { name: /Add to sort/ }))
    expect(harness.grid().view.get().sort).toHaveLength(2)
    await settle()
    expect(
      [...document.querySelectorAll('.tally-sort-index')].map((node) => node.textContent),
    ).toEqual(['2', '1'])
  })

  it('sorts text columns alphabetically and groups or ungroups', async () => {
    const harness = renderTally({ columns, rows })
    const menu = await openMenu(harness, 'Plan')
    expect(within(menu).getByText('2 unique values')).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sort Z to A' }))
    expect(harness.grid().view.get().sort).toEqual([{ column: 'plan', direction: 'desc' }])
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Sort A to Z' }),
    )
    expect(harness.grid().view.get().sort).toEqual([{ column: 'plan', direction: 'asc' }])
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Group by Plan' }),
    )
    expect(harness.grid().view.get().group).toEqual({ column: 'plan' })
    await settle()
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Ungroup' }),
    )
    expect(harness.grid().view.get().group).toBeUndefined()
  })

  it('prefills the filter, pins both sides and hides the column', async () => {
    const harness = renderTally({ columns, rows })
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Filter by Plan' }),
    )
    expect(screen.getByRole('combobox', { name: 'Filter' })).toHaveValue('Plan ')
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Pin left' }),
    )
    expect(columnState(harness, 'plan')?.pin).toBe('left')
    await settle()
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Unpin' }),
    )
    expect(columnState(harness, 'plan')?.pin).toBeUndefined()
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Pin right' }),
    )
    expect(columnState(harness, 'plan')?.pin).toBe('right')
    await settle()
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Unpin' }),
    )
    expect(columnState(harness, 'plan')?.pin).toBeUndefined()
    fireEvent.click(
      within(await openMenu(harness, 'Plan')).getByRole('menuitem', { name: 'Hide column' }),
    )
    expect(columnState(harness, 'plan')?.hidden).toBe(true)
  })

  it('fits and fills the column width', async () => {
    const harness = renderTally({ columns, rows })
    fireEvent.click(
      within(await openMenu(harness, 'Name')).getByRole('menuitem', { name: /Fit width/ }),
    )
    expect(columnState(harness, 'name')?.width).toBeGreaterThan(0)
    fireEvent.click(
      within(await openMenu(harness, 'Name')).getByRole('menuitemcheckbox', {
        name: /Fill remaining width/,
      }),
    )
    expect(columnState(harness, 'name')?.flex).toBe(1)
    await settle()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Fill remaining width/ }))
    expect(columnState(harness, 'name')?.flex).toBe(0)
  })

  it('omits sort, group and filter items for locked columns and counts rules', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() =>
      harness
        .grid()
        .view.setRules([
          { id: 'r1', column: 'locked', op: 'eq', value: 'a', style: { bold: true } },
        ]),
    )
    const menu = await openMenu(harness, 'Locked')
    expect(within(menu).queryByRole('menuitem', { name: /Sort/ })).toBeNull()
    expect(within(menu).queryByRole('menuitem', { name: /Group by/ })).toBeNull()
    expect(within(menu).queryByRole('menuitem', { name: /Filter by/ })).toBeNull()
    expect(within(menu).getByRole('menuitem', { name: /Formatting rules/ })).toHaveTextContent('1')
  })

  it('picks a footer aggregate from the submenu', async () => {
    const harness = renderTally({ columns, rows })
    const menu = await openMenu(harness, 'MRR')
    const trigger = within(menu).getByRole('menuitem', { name: /Footer/ })
    expect(trigger).toHaveTextContent('None')
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Avg' }))
    expect(harness.grid().view.get().footer).toEqual({ mrr: 'avg' })
    await settle()
    expect(trigger).toHaveTextContent('Avg')
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'None' }))
    expect(harness.grid().view.get().footer).toEqual({})
  })

  it('opens at the pointer on right click', async () => {
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    fireEvent.contextMenu(within(grid).getByRole('columnheader', { name: /^MRR/ }))
    const item = await screen.findByRole('menuitem', { name: 'Hide column' })
    fireEvent.click(item)
    expect(columnState(harness, 'mrr')?.hidden).toBe(true)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })
})

describe('ResizeHandle', () => {
  it('resizes with arrow keys, pointer drags and double clicks', async () => {
    const harness = renderTally({ columns, rows })
    const grid = await gridReady('One')
    const header = within(grid).getByRole('columnheader', { name: /^Name/ })
    const handle = within(header).getByRole('separator', { name: 'Resize Name' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(columnState(harness, 'name')?.width).toBe(128)
    await settle()
    fireEvent.keyDown(
      within(within(grid).getByRole('columnheader', { name: /^Name/ })).getByRole('separator'),
      {
        key: 'ArrowLeft',
      },
    )
    expect(columnState(harness, 'name')?.width).toBe(120)
    fireEvent.keyDown(handle, { key: 'Enter' })
    expect(columnState(harness, 'name')?.width).toBe(120)
    const live = (): HTMLElement =>
      within(within(grid).getByRole('columnheader', { name: /^Name/ })).getByRole('separator')
    const target = live()
    target.setPointerCapture = () => undefined
    fireEvent.pointerDown(target, { button: 2, clientX: 0 })
    fireEvent.pointerDown(target, { button: 0, clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(target, { clientX: 160 })
    expect(columnState(harness, 'name')?.width).toBe(180)
    fireEvent.pointerUp(target)
    fireEvent.pointerMove(target, { clientX: 400 })
    expect(columnState(harness, 'name')?.width).toBe(180)
    fireEvent.doubleClick(live())
    expect(columnState(harness, 'name')?.width).not.toBe(180)
  })
})
