import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createArraySource, createSchema, type DataSource, type FormatContext } from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { GridProvider, useGridContext } from './context.tsx'
import { useGrid } from './use-grid.ts'
import { useGridState, useRowModel, useRows, useSelection, useView } from './use-store.ts'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }],
})

const rows = [
  { id: 1, name: 'One', mrr: 10 },
  { id: 2, name: 'Two', mrr: 20 },
]

function Status(): ReactNode {
  const grid = useGridContext()
  const status = useGridState(grid, (state) => state.status)
  const model = useRowModel(grid)
  const sort = useView(grid, (view) => view.sort)
  const changed = useRows(grid).changed.size
  const selection = useSelection(grid)
  return (
    <output data-locale={grid.context.format.locale}>
      {status}:{model.rows.map((item) => item.key).join(',')}:{sort[0]?.direction ?? '-'}:{changed}:
      {selection.active?.row ?? '-'}
    </output>
  )
}

function Harness({
  source,
  format,
}: {
  readonly source: DataSource
  readonly format?: FormatContext | undefined
}): ReactNode {
  const grid = useGrid({ schema, source, format })
  return (
    <GridProvider grid={grid}>
      <Status />
      <button type="button" onClick={() => grid.view.toggleSort('mrr')}>
        sort
      </button>
      <button
        type="button"
        onClick={() => grid.selection.dispatch({ type: 'focus', cell: { row: 1, column: 0 } })}
      >
        focus
      </button>
    </GridProvider>
  )
}

describe('useGrid', () => {
  it('loads on mount and re-renders from store slices', async () => {
    const source = createArraySource(rows, schema)
    render(<Harness source={source} />)
    expect(screen.getByRole('status')).toHaveTextContent('loading::-:0:-')
    await screen.findByText('ready:1,2:-:0:-')
    act(() => screen.getByText('sort').click())
    await screen.findByText('ready:2,1:desc:0:-')
    act(() => screen.getByText('focus').click())
    expect(screen.getByRole('status')).toHaveTextContent('ready:2,1:desc:0:1')
    act(() => source.patch({ upserts: [{ id: 1, name: 'One', mrr: 11 }] }))
    expect(screen.getByRole('status')).toHaveTextContent('ready:2,1:desc:1:1')
  })

  it('recreates the grid when the source changes and disposes the old one', async () => {
    const first = createArraySource(rows, schema)
    const second = createArraySource([{ id: 9, name: 'Nine', mrr: 90 }], schema)
    const stop = vi.fn<() => void>()
    const spy = vi.spyOn(first, 'subscribe').mockReturnValue(stop)
    const view = render(<Harness source={first} />)
    await screen.findByText('ready:1,2:-:0:-')
    view.rerender(<Harness source={second} />)
    await screen.findByText('ready:9:-:0:-')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid with the current view when the format changes', async () => {
    const source = createArraySource(rows, schema)
    const english = { locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' }
    const view = render(<Harness source={source} format={english} />)
    await screen.findByText('ready:1,2:-:0:-')
    act(() => screen.getByText('sort').click())
    await screen.findByText('ready:2,1:desc:0:-')
    view.rerender(<Harness source={source} format={{ ...english, locale: 'de-DE' }} />)
    await screen.findByText('ready:2,1:desc:0:-')
    expect(screen.getByRole('status')).toHaveAttribute('data-locale', 'de-DE')
  })

  it('throws outside of a provider', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Status />)).toThrow('useGridContext must be used inside a GridProvider')
    silence.mockRestore()
  })
})
