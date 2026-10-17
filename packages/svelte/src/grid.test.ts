import { render, screen } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { get } from 'svelte/store'
import { createArraySource, createGrid, createSchema, type Grid } from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { gridStores, type ReactiveGrid } from './index.ts'
import Harness from './test/harness.svelte'
import Orphan from './test/orphan.svelte'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }],
})

const rows = [
  { id: 1, name: 'One', mrr: 10 },
  { id: 2, name: 'Two', mrr: 20 },
]

function capture(): {
  readonly onGrid: (grid: ReactiveGrid) => void
  readonly grid: () => ReactiveGrid
} {
  let held: ReactiveGrid | undefined
  return {
    onGrid: (grid) => {
      held = grid
    },
    grid: () => {
      if (held === undefined) throw new Error('harness is not mounted')
      return held
    },
  }
}

function track(grid: Grid): () => number {
  let active = 0
  const wrap = (store: { subscribe: (listener: never) => () => void }): void => {
    const subscribe = store.subscribe.bind(store)
    store.subscribe = (listener: never) => {
      active += 1
      const stop = subscribe(listener)
      return () => {
        active -= 1
        stop()
      }
    }
  }
  wrap(grid)
  wrap(grid.view)
  wrap(grid.rows)
  wrap(grid.selection)
  return () => active
}

describe('tally-svelte', () => {
  it('loads on mount and follows view, selection and live patches', async () => {
    const source = createArraySource(rows, schema)
    const { onGrid, grid } = capture()
    render(Harness, { source, schema, onGrid })
    const output = screen.getByRole('status')
    await vi.waitFor(() => expect(output.textContent).toBe('ready:1,2:-:0:-'))
    grid().current.view.toggleSort('mrr')
    await vi.waitFor(() => expect(output.textContent).toBe('ready:2,1:desc:0:-'))
    grid().current.selection.dispatch({ type: 'focus', cell: { row: 1, column: 0 } })
    flushSync()
    expect(output.textContent).toBe('ready:2,1:desc:0:1')
    source.patch({ upserts: [{ id: 1, name: 'One', mrr: 11 }] })
    flushSync()
    expect(output.textContent).toBe('ready:2,1:desc:1:1')
  })

  it('releases every subscription and disposes the grid on unmount', async () => {
    const source = createArraySource(rows, schema)
    const stop = vi.fn<() => void>()
    vi.spyOn(source, 'subscribe').mockReturnValue(stop)
    let active: (() => number) | undefined
    const view = render(Harness, {
      source,
      schema,
      onGrid: (grid: ReactiveGrid) => {
        active = track(grid.current)
      },
    })
    await vi.waitFor(() => expect(screen.getByRole('status').textContent).toBe('ready:1,2:-:0:-'))
    expect(active?.()).toBe(4)
    view.unmount()
    flushSync()
    expect(active?.()).toBe(0)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid on a new source and disposes the old one', async () => {
    const first = createArraySource(rows, schema)
    const second = createArraySource([{ id: 9, name: 'Nine', mrr: 90 }], schema)
    const stop = vi.fn<() => void>()
    vi.spyOn(first, 'subscribe').mockReturnValue(stop)
    const view = render(Harness, { source: first, schema })
    await vi.waitFor(() => expect(screen.getByRole('status').textContent).toBe('ready:1,2:-:0:-'))
    await view.rerender({ source: second })
    await vi.waitFor(() => expect(screen.getByRole('status').textContent).toBe('ready:9:-:0:-'))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid on a new schema and keeps the current view', async () => {
    const source = createArraySource(rows, schema)
    const { onGrid, grid } = capture()
    const view = render(Harness, { source, schema, onGrid })
    const output = screen.getByRole('status')
    await vi.waitFor(() => expect(output.textContent).toBe('ready:1,2:-:0:-'))
    grid().current.view.toggleSort('mrr')
    await vi.waitFor(() => expect(output.textContent).toBe('ready:2,1:desc:0:-'))
    const before = grid().current
    const next = createSchema({ columns: [{ id: 'name' }, { id: 'mrr', type: 'number' }] })
    await view.rerender({ schema: next })
    await vi.waitFor(() => expect(output.textContent).toBe('ready:2,1:desc:0:-'))
    expect(grid().current).not.toBe(before)
    expect(grid().current.schema).toBe(next)
  })

  it('recreates the grid only when the format context changes', async () => {
    const source = createArraySource(rows, schema)
    const format = { locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' }
    const { onGrid, grid } = capture()
    const view = render(Harness, { source, schema, pageSize: 10, format, onGrid })
    const first = grid().current
    await view.rerender({ pageSize: 20, format: { ...format } })
    expect(grid().current).toBe(first)
    await view.rerender({ format: { ...format, locale: 'de-DE' } })
    expect(grid().current).not.toBe(first)
    expect(grid().current.context.format.locale).toBe('de-DE')
  })

  it('throws when no grid is in context', () => {
    expect(() => render(Orphan)).toThrow('getGridContext must be used below setGridContext')
  })

  it('exposes store compatible readables', async () => {
    const source = createArraySource(rows, schema)
    const grid = createGrid({ schema, source })
    const stores = gridStores(grid)
    const seen: string[] = []
    const stop = stores.state.subscribe((state) => seen.push(state.status))
    await grid.load()
    flushSync()
    expect(seen).toEqual(['idle', 'loading', 'ready'])
    grid.view.toggleSort('mrr')
    await vi.waitFor(() => expect(get(stores.view).sort[0]?.direction).toBe('desc'))
    grid.selection.dispatch({ type: 'focus', cell: { row: 0, column: 0 } })
    expect(get(stores.selection).active?.row).toBe(0)
    source.patch({ upserts: [{ id: 1, name: 'One', mrr: 11 }] })
    expect(get(stores.rows).changed.size).toBe(1)
    stop()
    grid.dispose()
  })
})
