import { act, render, screen, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { createArraySource, createSchema, type View } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { useGrid } from '../hooks/use-grid.ts'
import { Tally } from './tally.tsx'

const schema = createSchema({
  columns: [
    { id: 'name', label: 'Account', pin: 'left', width: 200 },
    {
      id: 'status',
      type: 'enum',
      options: [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'trial', label: 'Trial' },
      ],
      group: 'Account',
    },
    { id: 'owner', type: 'person', group: 'Account' },
    { id: 'mrr', type: 'currency', aggregate: 'sum', group: 'Revenue' },
    { id: 'growth', type: 'percent', group: 'Revenue' },
    { id: 'health', type: 'bar' },
    { id: 'renewal', type: 'date', aggregate: 'min' },
    { id: 'site', type: 'url', pin: 'right' },
  ],
})

const rows = [
  {
    id: 1,
    name: 'Kite Supply',
    status: 'active',
    owner: 'Priya Reyes',
    mrr: 25610,
    growth: 48.8,
    health: 57,
    renewal: '2027-03-19',
    site: 'https://kitesupply.com',
  },
  {
    id: 2,
    name: 'Atlas Labs',
    status: 'trial',
    owner: 'Sven Lindqvist',
    mrr: 21270,
    growth: -19.4,
    health: 35,
    renewal: '2027-02-13',
    site: 'https://atlaslabs.com',
  },
]

function Harness({ view }: { readonly view?: View | undefined }): ReactNode {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({
    schema,
    source,
    view,
    format: { locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' },
  })
  return <Tally grid={grid} initialSize={{ width: 1200, height: 600 }} label="Accounts" />
}

describe('Tally', () => {
  it('renders an ARIA grid with formatted cells, pins and footer aggregates', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid', { name: 'Accounts' })
    await within(grid).findByText('Kite Supply')
    expect(grid).toHaveAttribute('aria-rowcount', '3')
    expect(grid).toHaveAttribute('aria-colcount', '9')
    const headers = within(grid).getAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual([
      '',
      'Account',
      'status',
      'owner',
      'mrr',
      'growth',
      'health',
      'renewal',
      'site',
    ])
    expect(headers[1]).toHaveAttribute('data-pin', 'left')
    expect(headers[8]).toHaveAttribute('data-pin', 'right')
    expect(headers[8]).toHaveAttribute('data-pin-edge')
    expect(within(grid).getByText('Revenue')).toBeInTheDocument()
    const cells = within(grid).getAllByRole('gridcell')
    expect(cells.some((cell) => cell.textContent === '$25,610.00')).toBe(true)
    const growth = cells.find((cell) => cell.textContent === '-19.4%')
    expect(growth).toHaveAttribute('data-sign', 'down')
    expect(within(grid).getByText('Active').closest('.tally-pill')).toHaveStyle({
      '--tally-pill-color': 'green',
    })
    expect(within(grid).getByText('PR')).toHaveClass('tally-avatar')
    expect(within(grid).getByRole('link', { name: 'https://kitesupply.com' })).toHaveAttribute(
      'target',
      '_blank',
    )
    const footer = grid.querySelector('.tally-footer')
    expect(footer).toHaveTextContent('Sum')
    expect(footer).toHaveTextContent('$46.9K')
    const range = footer?.querySelector('[data-column="renewal"] [title]')
    expect(range?.getAttribute('title')).toMatch(/2027.*2027/)
    expect(range).toHaveTextContent('Feb–Mar 27')
    expect(footer).toHaveTextContent('1–2 / 2')
  })

  it('sorts from the header and exposes aria-sort', async () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('Kite Supply')
    const header = within(grid).getByRole('columnheader', { name: 'mrr' })
    expect(header).toHaveAttribute('aria-sort', 'none')
    act(() => within(header).getByRole('button').click())
    await within(grid).findByText('↓')
    expect(within(grid).getByRole('columnheader', { name: /mrr/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    const names = within(grid)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('gridcell')[0]?.textContent)
    expect(names).toEqual(['Kite Supply', 'Atlas Labs'])
  })

  it('renders groups with counts and conditional formatting from the view', async () => {
    render(
      <Harness
        view={{
          columns: schema.columns.map((column) => ({ id: column.id })),
          sort: [],
          group: { column: 'status' },
          density: 'compact',
          rules: [
            {
              id: 'r1',
              column: 'health',
              op: 'lt',
              value: 40,
              style: { background: 'red', bold: true },
            },
          ],
          footer: {},
          pinnedRows: [2],
          expanded: [],
          collapsedGroups: [],
        }}
      />,
    )
    const grid = screen.getByRole('grid')
    await within(grid).findByText('Kite Supply')
    expect(grid.closest('.tally')).toHaveAttribute('data-density', 'compact')
    const groups = grid.querySelectorAll('.tally-body .tally-group')
    expect([...groups].map((group) => group.textContent)).toEqual(['Active1', 'Trial1'])
    const pinned = grid.querySelector('.tally-pinned-rows [role="row"]')
    expect(pinned).toHaveTextContent('Atlas Labs')
    const flagged = grid.querySelector('.tally-pinned-rows [data-column="health"]')
    expect(flagged).toHaveAttribute('data-rule')
    expect(flagged).toHaveAttribute('data-bold')
    expect(flagged).toHaveStyle({ '--tally-rule-background': 'red' })
  })
})
