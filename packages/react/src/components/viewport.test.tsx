import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createArraySource, createSchema, type DataSource, type RowData } from 'tally-core'
import type { CellProps } from './cells/renderers.tsx'
import { gridReady, renderTally, settle } from '../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  {
    id: 'plan',
    label: 'Plan',
    type: 'enum',
    options: [
      { value: 'pro', label: 'Pro', color: 'blue' },
      { value: 'team', label: 'Team' },
    ],
  },
  { id: 'tier', label: 'Tier', type: 'enum' },
  { id: 'paid', label: 'Paid', type: 'bool' },
  { id: 'mrr', label: 'MRR', type: 'currency' },
]

const rows = [
  { id: 1, name: 'One', plan: 'pro', tier: 'gold', paid: true, mrr: 10 },
  { id: 2, name: 'Two', plan: 'team', tier: 'gold', paid: false, mrr: 20 },
  { id: 3, name: 'Three', plan: 'team', tier: 'silver', paid: true, mrr: 30 },
]

function failingSource(rowsIn: readonly RowData[]): DataSource {
  const base = createArraySource(rowsIn, createSchema({ columns }))
  let calls = 0
  return {
    ...base,
    query: (request, signal) => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('Network down')) : base.query(request, signal)
    },
  }
}

function stalledSource(rowsIn: readonly RowData[]): DataSource {
  const base = createArraySource(rowsIn, createSchema({ columns }))
  return { ...base, query: () => new Promise(() => undefined) }
}

function stringFailure(rowsIn: readonly RowData[]): DataSource {
  const base = createArraySource(rowsIn, createSchema({ columns }))
  return { ...base, query: () => Promise.reject('offline') }
}

async function emptyCell(title: string): Promise<HTMLElement> {
  const text = await within(screen.getByRole('grid')).findByText(title)
  const cell = text.closest<HTMLElement>('[role="gridcell"]')
  if (cell?.parentElement?.getAttribute('role') !== 'row')
    throw new Error('empty state not in a row')
  return cell
}

describe('Tally viewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('re-renders only the rows that scroll into view', async () => {
    const rendered: unknown[] = []
    const many = Array.from({ length: 400 }, (_, index) => ({ id: index, name: `Row ${index}` }))
    renderTally({
      columns: [{ id: 'name', label: 'Name' }],
      rows: many,
      props: {
        renderers: {
          text: ({ text, row }: CellProps) => {
            rendered.push(row['id'])
            return text
          },
        },
      },
    })
    await gridReady('Row 0')
    const viewport = screen.getByRole('grid')
    const before = rendered.length
    await act(async () => {
      viewport.scrollTop = 96
      fireEvent.scroll(viewport)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const fresh = rendered.slice(before)
    expect(fresh.length).toBeGreaterThan(0)
    expect(new Set(fresh).size).toBe(fresh.length)
    expect(fresh.length).toBeLessThan(6)
  })

  it('shows the error with a retry that reloads', async () => {
    renderTally({ columns, rows, createSource: failingSource })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Network down')
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    await gridReady('One')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('prints non error failures', async () => {
    renderTally({ columns, rows, createSource: stringFailure })
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })

  it('marks the grid busy while loading', async () => {
    renderTally({ columns, rows, createSource: stalledSource })
    await settle()
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '-1')
    expect(document.querySelector('.tally-progress')).not.toBeNull()
  })

  it('offers to clear a filter that matches nothing', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() =>
      harness.grid().view.setFilter({ type: 'condition', column: 'mrr', op: 'gt', value: 99 }),
    )
    const status = await emptyCell('No rows match')
    fireEvent.click(within(status).getByRole('button', { name: 'Clear filter' }))
    await gridReady('One')
    expect(harness.grid().view.get().filter).toBeUndefined()
  })

  it('shows an empty state for empty sources', async () => {
    renderTally({ columns, rows: [] })
    expect(await emptyCell('No rows')).toHaveAttribute('aria-colspan', '6')
  })

  it('brings hidden columns back from the empty state', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() => {
      for (const column of columns) harness.grid().view.setColumnHidden(column.id, true)
    })
    const status = await emptyCell('No visible columns')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '1')
    fireEvent.click(within(status).getByRole('button', { name: 'Show all columns' }))
    await gridReady('One')
  })

  it('passes theme, direction and class names through', async () => {
    renderTally({
      columns,
      rows,
      props: { theme: 'dark', dir: 'rtl', className: 'mine', style: { height: 300 } },
    })
    await gridReady('One')
    const root = document.querySelector('.tally')
    expect(root).toHaveClass('mine')
    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(root).toHaveAttribute('dir', 'rtl')
  })

  it('switches to cards when the root is narrow and observes resizes', async () => {
    const observed: Element[] = []
    const disconnect = vi.fn<() => void>()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(element: Element): void {
          observed.push(element)
        }
        unobserve(): void {}
        disconnect(): void {
          disconnect()
        }
      },
    )
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('tally') ? 400 : 0
      })
    const view = renderTally({ columns, rows })
    expect(await screen.findByRole('article', { name: 'One' })).toBeInTheDocument()
    expect(document.querySelector('.tally')).toHaveAttribute('data-narrow')
    expect(observed.length).toBeGreaterThan(0)
    view.unmount()
    expect(disconnect).toHaveBeenCalled()
    width.mockRestore()
  })

  it('observes the header stack when the grid is wide', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1600)
    renderTally({ columns, rows })
    await gridReady('One')
    expect(screen.getByRole('grid')).toHaveStyle({ '--tally-viewport-width': '1600px' })
    width.mockRestore()
  })
})

describe('Footer', () => {
  it('draws distributions for categorical counts and summaries elsewhere', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() => {
      harness.grid().view.setFooter('plan', 'count')
      harness.grid().view.setFooter('tier', 'count')
      harness.grid().view.setFooter('paid', 'count')
      harness.grid().view.setFooter('mrr', 'sum')
    })
    await settle()
    const footer = document.querySelector('.tally-footer')!
    const plan = footer.querySelector('[data-column="plan"] .tally-distribution')
    expect(plan).toHaveAttribute('title', 'Pro 1 · Team 2')
    expect(plan?.querySelector('i')).toHaveStyle({ background: 'blue' })
    expect(footer.querySelector('[data-column="tier"] .tally-distribution')).toHaveAttribute(
      'title',
      'gold 2 · silver 1',
    )
    expect(footer.querySelector('[data-column="paid"] .tally-distribution')).not.toBeNull()
    expect(footer.querySelector('[data-column="mrr"]')).toHaveTextContent('$60')
  })

  it('shows the plain total when rows are grouped', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    act(() => harness.grid().view.setGroup('plan'))
    await waitFor(() =>
      expect(document.querySelectorAll('.tally-body .tally-group')).toHaveLength(2),
    )
    expect(document.querySelector('.tally-footer [data-column="name"]')).toHaveTextContent(/^3$/)
  })
})

describe('Summaries', () => {
  it('formats counts, distinct values, averages and date ranges', async () => {
    const harness = renderTally({
      columns: [
        { id: 'name', label: 'Name' },
        { id: 'plan', label: 'Plan' },
        { id: 'mrr', label: 'MRR', type: 'number' },
        { id: 'renewal', label: 'Renewal', type: 'date' },
      ],
      rows: [
        { id: 1, name: 'One', plan: 'a', mrr: 1000, renewal: '2026-01-01' },
        { id: 2, name: 'Two', plan: 'a', mrr: 3000, renewal: '2026-04-01' },
        { id: 3, name: 'Three', plan: 'b', mrr: 2000, renewal: null },
      ],
    })
    await gridReady('One')
    act(() => {
      harness.grid().view.setFooter('name', 'count')
      harness.grid().view.setFooter('plan', 'distinct')
      harness.grid().view.setFooter('mrr', 'avg')
      harness.grid().view.setFooter('renewal', 'max')
    })
    await settle()
    const footer = document.querySelector('.tally-footer')!
    expect(footer.querySelector('[data-column="name"]')).toHaveTextContent('Count3')
    expect(footer.querySelector('[data-column="plan"]')).toHaveTextContent('Distinct2')
    expect(footer.querySelector('[data-column="mrr"]')).toHaveTextContent('Avg2K')
    expect(footer.querySelector('[data-column="renewal"]')).toHaveTextContent('Jan–Apr 26')
    act(() => harness.grid().view.setGroup('plan'))
    await waitFor(() =>
      expect(document.querySelectorAll('.tally-body .tally-group')).toHaveLength(2),
    )
    const group = document.querySelector('.tally-body .tally-group [data-column="mrr"]')
    expect(group).toHaveTextContent('Avg2K')
    expect(
      document.querySelector('.tally-body .tally-group [data-column="name"]'),
    ).toHaveTextContent('a2')
  })
})
