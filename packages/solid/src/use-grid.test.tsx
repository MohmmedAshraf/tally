import { render, renderHook } from '@solidjs/testing-library'
import { createRoot, createSignal, type Accessor, type JSX } from 'solid-js'
import {
  createArraySource,
  createSchema,
  type DataSource,
  type Grid,
  type Schema,
} from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import { GridContext, useGridContext } from './context.ts'
import { createGridState, createRows, createSelection, createView } from './create-store.ts'
import { useGrid } from './use-grid.ts'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }],
})

const rows = [
  { id: 1, name: 'One', mrr: 10 },
  { id: 2, name: 'Two', mrr: 20 },
]

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

function Status(): JSX.Element {
  const grid = useGridContext()
  const state = createGridState(grid)
  const view = createView(grid)
  const loaded = createRows(grid)
  const selection = createSelection(grid)
  return (
    <output>
      {[
        state().status,
        loaded()
          .rows.map((row) => String(row['id']))
          .join(','),
        view().sort[0]?.direction ?? '-',
        loaded().changed.size,
        selection().active?.row ?? '-',
      ].join(':')}
    </output>
  )
}

interface HarnessProps {
  readonly source: Accessor<DataSource>
  readonly schema: Accessor<Schema>
  readonly onGrid?: ((grid: Accessor<Grid>) => void) | undefined
}

function Harness(props: HarnessProps): JSX.Element {
  const grid = useGrid(() => ({ schema: props.schema(), source: props.source() }))
  props.onGrid?.(grid)
  return (
    <GridContext.Provider value={grid}>
      <Status />
    </GridContext.Provider>
  )
}

function mount(source: DataSource, onGrid?: (grid: Accessor<Grid>) => void) {
  const [currentSource, setSource] = createSignal(source)
  const [currentSchema, setSchema] = createSignal(schema)
  const result = render(() => (
    <Harness source={currentSource} schema={currentSchema} onGrid={onGrid} />
  ))
  const output = (): string | null => result.container.querySelector('output')?.textContent ?? null
  return { ...result, output, setSource, setSchema }
}

function capture(): {
  readonly onGrid: (grid: Accessor<Grid>) => void
  readonly grid: Accessor<Grid>
} {
  let held: Accessor<Grid> | undefined
  return {
    onGrid: (grid) => {
      held = grid
    },
    grid: () => {
      if (held === undefined) throw new Error('harness is not mounted')
      return held()
    },
  }
}

describe('tally-solid', () => {
  it('loads on mount and follows view, selection and live patches', async () => {
    const source = createArraySource(rows, schema)
    const { onGrid, grid } = capture()
    const { output } = mount(source, onGrid)
    await vi.waitFor(() => expect(output()).toBe('ready:1,2:-:0:-'))
    grid().view.toggleSort('mrr')
    await vi.waitFor(() => expect(output()).toBe('ready:2,1:desc:0:-'))
    grid().selection.dispatch({ type: 'focus', cell: { row: 1, column: 0 } })
    expect(output()).toBe('ready:2,1:desc:0:1')
    source.patch({ upserts: [{ id: 1, name: 'One', mrr: 11 }] })
    expect(output()).toBe('ready:2,1:desc:1:1')
  })

  it('releases every subscription and disposes the grid on unmount', async () => {
    const source = createArraySource(rows, schema)
    const stop = vi.fn<() => void>()
    vi.spyOn(source, 'subscribe').mockReturnValue(stop)
    let active: (() => number) | undefined
    const { output, unmount } = mount(source, (grid) => {
      active = track(grid())
    })
    await vi.waitFor(() => expect(output()).toBe('ready:1,2:-:0:-'))
    expect(active?.()).toBe(4)
    unmount()
    expect(active?.()).toBe(0)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid on a new source and disposes the old one', async () => {
    const first = createArraySource(rows, schema)
    const second = createArraySource([{ id: 9, name: 'Nine', mrr: 90 }], schema)
    const stop = vi.fn<() => void>()
    vi.spyOn(first, 'subscribe').mockReturnValue(stop)
    const { output, setSource } = mount(first)
    await vi.waitFor(() => expect(output()).toBe('ready:1,2:-:0:-'))
    setSource(second)
    await vi.waitFor(() => expect(output()).toBe('ready:9:-:0:-'))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid on a new schema and keeps the current view', async () => {
    const source = createArraySource(rows, schema)
    const { onGrid, grid } = capture()
    const { output, setSchema } = mount(source, onGrid)
    await vi.waitFor(() => expect(output()).toBe('ready:1,2:-:0:-'))
    grid().view.toggleSort('mrr')
    await vi.waitFor(() => expect(output()).toBe('ready:2,1:desc:0:-'))
    const before = grid()
    const next = createSchema({ columns: [{ id: 'name' }, { id: 'mrr', type: 'number' }] })
    setSchema(next)
    await vi.waitFor(() => expect(output()).toBe('ready:2,1:desc:0:-'))
    expect(grid()).not.toBe(before)
    expect(grid().schema).toBe(next)
  })

  it('recreates the grid only when the format context changes', () => {
    const source = createArraySource(rows, schema)
    createRoot((dispose) => {
      const [pageSize, setPageSize] = createSignal(10)
      const [format, setFormat] = createSignal({
        locale: 'en-US',
        timeZone: 'UTC',
        numberingSystem: 'latn',
      })
      const grid = useGrid(() => ({ schema, source, pageSize: pageSize(), format: format() }))
      const first = grid()
      setPageSize(20)
      setFormat({ ...format() })
      expect(grid()).toBe(first)
      setFormat({ ...format(), locale: 'de-DE' })
      expect(grid()).not.toBe(first)
      expect(grid().context.format.locale).toBe('de-DE')
      dispose()
    })
  })

  it('accepts plain options and a plain grid', () => {
    const source = createArraySource(rows, schema)
    const { result, cleanup } = renderHook(() => {
      const grid = useGrid({ schema, source })
      return createView(grid())
    })
    expect(result().sort).toEqual([])
    cleanup()
  })

  it('throws outside of a provider', () => {
    expect(() => renderHook(useGridContext)).toThrow(
      'useGridContext must be used inside a GridContext.Provider',
    )
  })
})
