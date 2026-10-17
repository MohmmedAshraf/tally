import { mount } from '@vue/test-utils'
import {
  createArraySource,
  createSchema,
  type DataSource,
  type Grid,
  type Schema,
} from 'tally-core'
import { describe, expect, it, vi } from 'vitest'
import {
  createSSRApp,
  defineComponent,
  effectScope,
  h,
  nextTick,
  shallowRef,
  type ComputedRef,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { injectGrid, provideGrid } from './context.ts'
import { useGrid } from './use-grid.ts'
import { useGridState, useRows, useSelection, useView } from './use-store.ts'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }],
})

const rows = [
  { id: 1, name: 'One', mrr: 10 },
  { id: 2, name: 'Two', mrr: 20 },
]

const Status = defineComponent(function Status() {
  const grid = injectGrid()
  const state = useGridState(grid)
  const view = useView(grid)
  const loaded = useRows(grid)
  const selection = useSelection(grid)
  return () =>
    h(
      'output',
      [
        state.value.status,
        loaded.value.rows.map((row) => String(row['id'])).join(','),
        view.value.sort[0]?.direction ?? '-',
        loaded.value.changed.size,
        selection.value.active?.row ?? '-',
      ].join(':'),
    )
})

interface HarnessProps {
  readonly source: DataSource
  readonly schema: Schema
  readonly onGrid?: ((grid: ComputedRef<Grid>) => void) | undefined
}

const Harness = defineComponent(
  function Harness(props: HarnessProps) {
    const grid = useGrid(() => ({ schema: props.schema, source: props.source }))
    props.onGrid?.(grid)
    provideGrid(grid)
    return () => h(Status)
  },
  { props: ['source', 'schema', 'onGrid'] },
)

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

function capture(): {
  readonly onGrid: (grid: ComputedRef<Grid>) => void
  readonly grid: () => Grid
} {
  let held: ComputedRef<Grid> | undefined
  return {
    onGrid: (grid) => {
      held = grid
    },
    grid: () => {
      if (held === undefined) throw new Error('harness is not mounted')
      return held.value
    },
  }
}

describe('tally-vue', () => {
  it('loads on mount and follows view, selection and live patches', async () => {
    const source = createArraySource(rows, schema)
    const { onGrid, grid } = capture()
    const wrapper = mount(Harness, { props: { source, schema, onGrid } })
    expect(wrapper.text()).toBe('idle::-:0:-')
    await nextTick()
    expect(wrapper.text()).toBe('loading::-:0:-')
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:1,2:-:0:-'))
    grid().view.toggleSort('mrr')
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:2,1:desc:0:-'))
    grid().selection.dispatch({ type: 'focus', cell: { row: 1, column: 0 } })
    await nextTick()
    expect(wrapper.text()).toBe('ready:2,1:desc:0:1')
    source.patch({ upserts: [{ id: 1, name: 'One', mrr: 11 }] })
    await nextTick()
    expect(wrapper.text()).toBe('ready:2,1:desc:1:1')
  })

  it('releases every subscription and disposes the grid on unmount', async () => {
    const source = createArraySource(rows, schema)
    const stop = vi.fn<() => void>()
    vi.spyOn(source, 'subscribe').mockReturnValue(stop)
    let active: (() => number) | undefined
    const wrapper = mount(Harness, {
      props: {
        source,
        schema,
        onGrid: (grid: ComputedRef<Grid>) => {
          active = track(grid.value)
        },
      },
    })
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:1,2:-:0:-'))
    expect(active?.()).toBe(4)
    wrapper.unmount()
    expect(active?.()).toBe(0)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid on a new source and disposes the old one', async () => {
    const first = createArraySource(rows, schema)
    const second = createArraySource([{ id: 9, name: 'Nine', mrr: 90 }], schema)
    const stop = vi.fn<() => void>()
    vi.spyOn(first, 'subscribe').mockReturnValue(stop)
    const wrapper = mount(Harness, { props: { source: first, schema } })
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:1,2:-:0:-'))
    await wrapper.setProps({ source: second })
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:9:-:0:-'))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('recreates the grid on a new schema and keeps the current view', async () => {
    const source = createArraySource(rows, schema)
    const { onGrid, grid } = capture()
    const wrapper = mount(Harness, { props: { source, schema, onGrid } })
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:1,2:-:0:-'))
    grid().view.toggleSort('mrr')
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:2,1:desc:0:-'))
    const before = grid()
    const next = createSchema({ columns: [{ id: 'name' }, { id: 'mrr', type: 'number' }] })
    await wrapper.setProps({ schema: next })
    await vi.waitFor(() => expect(wrapper.text()).toBe('ready:2,1:desc:0:-'))
    expect(grid()).not.toBe(before)
    expect(grid().schema).toBe(next)
  })

  it('recreates the grid only when the format context changes', () => {
    const source = createArraySource(rows, schema)
    const pageSize = shallowRef(10)
    const format = shallowRef({ locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' })
    const scope = effectScope()
    const grid = scope.run(() =>
      useGrid(() => ({ schema, source, pageSize: pageSize.value, format: format.value })),
    )
    const first = grid?.value
    pageSize.value = 20
    format.value = { ...format.value }
    expect(grid?.value).toBe(first)
    format.value = { ...format.value, locale: 'de-DE' }
    expect(grid?.value).not.toBe(first)
    expect(grid?.value.context.format.locale).toBe('de-DE')
    scope.stop()
  })

  it('renders on the server without loading or subscribing', async () => {
    const source = createArraySource(rows, schema)
    const listen = vi.spyOn(source, 'subscribe')
    const html = await renderToString(createSSRApp(Harness, { source, schema }))
    expect(html).toBe('<output>idle::-:0:-</output>')
    expect(listen).not.toHaveBeenCalled()
  })

  it('throws when no grid is provided', () => {
    const Orphan = defineComponent(function Orphan() {
      injectGrid()
      return () => null
    })
    const silence = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => mount(Orphan)).toThrow('injectGrid must be used below provideGrid')
    silence.mockRestore()
  })
})
