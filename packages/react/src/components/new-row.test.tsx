import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import {
  createArraySource,
  createSchema,
  type DataSource,
  type Grid,
  type QueryRequest,
} from 'tally-core'
import { describe, expect, it } from 'vitest'
import { useGrid } from '../hooks/use-grid.ts'
import { Tally } from './tally.tsx'

const schema = createSchema({ columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }] })

const rows = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
  mrr: index,
}))

let current: Grid | undefined

function Remember({ grid }: { readonly grid: Grid }): ReactNode {
  useEffect(() => {
    current = grid
  }, [grid])
  return null
}

function pagedSource(): DataSource {
  return {
    capabilities: {
      filter: true,
      sort: true,
      group: false,
      search: false,
      aggregates: false,
      facets: false,
      pagination: 'offset',
      mutate: false,
      live: false,
    },
    query: (request: QueryRequest) => {
      const page = request.page !== undefined && 'offset' in request.page ? request.page : undefined
      const slice = page === undefined ? rows : rows.slice(page.offset, page.offset + page.limit)
      return Promise.resolve({ rows: slice, total: rows.length })
    },
  }
}

function Harness({
  source,
  pageSize,
}: {
  readonly source: DataSource
  readonly pageSize?: number
}): ReactNode {
  const grid = useGrid({ schema, source, pageSize })
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

describe('NewRow', () => {
  it('creates a row from the add row and moves editing to the next column', async () => {
    const [source] = [createArraySource(rows.slice(0, 2), schema)]
    render(<Harness source={source} />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('Row 1')
    const addRow = within(grid).getByRole('row', { name: 'Add row' })
    fireEvent.click(within(addRow).getByRole('button', { name: 'Add row: name' }))
    const input = within(addRow).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Kite Robotics' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    await settle()
    await settle()
    expect(source.rows().at(-1)).toMatchObject({ name: 'Kite Robotics' })
    expect(current?.rows.history().at(-1)?.label).toBe('Add row')
    const created = within(grid)
      .getAllByRole('row')
      .find((row) => row.textContent.includes('Kite Robotics'))
    expect(created).toHaveAttribute('aria-rowindex', '4')
    expect(within(created!).getByRole('textbox')).toBeInTheDocument()
  })

  it('hides the add row for read only sources and shows a pager for offset sources', async () => {
    render(<Harness source={pagedSource()} pageSize={10} />)
    const grid = screen.getByRole('grid')
    await within(grid).findByText('Row 1')
    expect(within(grid).queryByRole('row', { name: 'Add row' })).toBeNull()
    const pager = screen.getByRole('navigation', { name: 'Pages' })
    expect(
      within(pager)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['', '1', '2', '3', ''])
    fireEvent.click(within(pager).getByRole('button', { name: 'Next page' }))
    await within(grid).findByText('Row 11')
    expect(within(pager).getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('11–20 / 25')).toBeInTheDocument()
  })
})
