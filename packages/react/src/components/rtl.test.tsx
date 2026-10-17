import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cellAt, gridReady, renderTally, settle } from '../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name', pin: 'left' as const, width: 120 },
  { id: 'mrr', label: 'MRR', type: 'currency' },
  { id: 'seats', label: 'Seats', type: 'int' },
  { id: 'site', label: 'Site', type: 'url', pin: 'right' as const },
]

const rows = [
  { id: 1, name: 'One', mrr: 1234.5, seats: 1200, site: 'https://one.test' },
  { id: 2, name: 'Two', mrr: 30, seats: 4, site: 'https://two.test' },
]

const wide = Array.from({ length: 30 }, (_, index) => ({
  id: `c${index}`,
  label: `C${index}`,
  width: 160,
}))

const rtl = { dir: 'rtl' as const }

afterEach(() => {
  vi.restoreAllMocks()
})

function active(harness: ReturnType<typeof renderTally>): number | undefined {
  return harness.grid().selection.get().active?.column
}

describe('right to left', () => {
  it('pins columns to the inline start and end', async () => {
    renderTally({ columns, rows, props: rtl })
    const grid = await gridReady('One')
    expect(grid.closest('.tally')).toHaveAttribute('dir', 'rtl')
    const name = within(grid).getByRole('columnheader', { name: /^Name/ })
    const site = within(grid).getByRole('columnheader', { name: /^Site/ })
    expect(name).toHaveAttribute('data-pin', 'left')
    expect(name.style.getPropertyValue('--tally-pin-offset')).toBe('44px')
    expect(site).toHaveAttribute('data-pin', 'right')
    expect(site.style.getPropertyValue('--tally-pin-offset')).toBe('0px')
    expect(cellAt(0, 0).style.getPropertyValue('--tally-pin-offset')).toBe('44px')
  })

  it('moves focus with the visual direction of the arrow keys', async () => {
    const harness = renderTally({ columns, rows, props: rtl })
    const grid = await gridReady('One')
    act(() => harness.grid().selection.dispatch({ type: 'focus', cell: { row: 0, column: 1 } }))
    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    expect(active(harness)).toBe(0)
    fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    expect(active(harness)).toBe(2)
    fireEvent.keyDown(grid, { key: 'ArrowLeft', shiftKey: true })
    expect(harness.grid().selection.get().range?.focus.column).toBe(3)
  })

  it('reads the direction from an ancestor', async () => {
    const host = document.createElement('div')
    host.dir = 'rtl'
    host.style.direction = 'rtl'
    document.body.append(host)
    const harness = renderTally({ columns, rows, container: host })
    const grid = await gridReady('One')
    act(() => harness.grid().selection.dispatch({ type: 'focus', cell: { row: 0, column: 1 } }))
    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    expect(active(harness)).toBe(0)
    harness.unmount()
    host.remove()
  })

  it('scrolls virtual columns to negative offsets', async () => {
    const lefts: number[] = []
    vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(
      (options?: ScrollToOptions | number) => {
        if (typeof options === 'object' && options.left !== undefined) lefts.push(options.left)
      },
    )
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(5000)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
    const harness = renderTally({ columns: wide, rows: [{ id: 1, c0: 'first' }], props: rtl })
    const grid = await gridReady('first')
    act(() => harness.grid().selection.dispatch({ type: 'focus', cell: { row: 0, column: 0 } }))
    fireEvent.keyDown(grid, { key: 'End', ctrlKey: true })
    await settle()
    expect(lefts.some((left) => left < 0)).toBe(true)
  })

  it('resizes toward the inline end', async () => {
    const harness = renderTally({ columns, rows, props: rtl })
    const grid = await gridReady('One')
    const handle = (): HTMLElement =>
      within(within(grid).getByRole('columnheader', { name: /^Name/ })).getByRole('separator')
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(
      harness
        .grid()
        .view.get()
        .columns.find((state) => state.id === 'name')?.width,
    ).toBe(128)
    await settle()
    const target = handle()
    target.setPointerCapture = () => undefined
    fireEvent.pointerDown(target, { button: 0, clientX: 300, pointerId: 1 })
    fireEvent.pointerMove(target, { clientX: 260 })
    fireEvent.pointerUp(target)
    expect(
      harness
        .grid()
        .view.get()
        .columns.find((state) => state.id === 'name')?.width,
    ).toBe(168)
  })

  it('opens column menus that pin to the visual side', async () => {
    const harness = renderTally({ columns, rows, props: rtl })
    await gridReady('One')
    await waitFor(() => expect(harness.grid().get().status).toBe('ready'))
    const trigger = document.querySelector<HTMLElement>('[aria-label="MRR options"]')
    if (trigger === null) throw new Error('missing MRR menu')
    fireEvent.click(trigger)
    const menu = await screen.findByRole('menu')
    expect(menu.closest('[dir="rtl"]')).not.toBeNull()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Pin right' }))
    expect(
      harness
        .grid()
        .view.get()
        .columns.find((state) => state.id === 'mrr')?.pin,
    ).toBe('left')
  })

  it('opens the detail sheet in cards layout', async () => {
    renderTally({ columns, rows, props: { ...rtl, layout: 'cards' } })
    const card = await screen.findByRole('article', { name: 'One' })
    act(() => within(card).getByRole('button', { name: 'Open One' }).click())
    const sheet = await screen.findByRole('dialog', { name: 'One' })
    expect(sheet.closest('[dir="rtl"]')).not.toBeNull()
    act(() => within(sheet).getByRole('button', { name: 'Close' }).click())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('locale', () => {
  it('formats cells, counts and row numbers with arabic digits', async () => {
    renderTally({
      columns,
      rows,
      format: { locale: 'ar-EG', numberingSystem: 'arab' },
      props: rtl,
    })
    const grid = await gridReady('One')
    expect(cellAt(0, 2)).toHaveTextContent('١٬٢٠٠')
    expect(cellAt(0, 1).textContent).toContain('١٬٢٣٤٫٥٠')
    expect(within(grid).getAllByText('١')[0]).toHaveClass('tally-row-number')
    expect(document.querySelector('.tally-count')).toHaveTextContent('٢ rows')
  })

  it('formats german currency and counts', async () => {
    renderTally({
      columns: [
        columns[0]!,
        { id: 'mrr', label: 'MRR', type: 'currency', format: { currency: 'EUR' } },
      ],
      rows: Array.from({ length: 1200 }, (_, index) => ({
        id: index,
        name: `Row ${index}`,
        mrr: index === 0 ? 1234.5 : 1,
      })),
      format: { locale: 'de-DE' },
    })
    await gridReady('Row 0')
    expect(cellAt(0, 1)).toHaveTextContent('1.234,50 €')
    expect(document.querySelector('.tally-count')).toHaveTextContent('1.200 rows')
  })
})
