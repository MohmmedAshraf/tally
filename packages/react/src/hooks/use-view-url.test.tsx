import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createArraySource, createGrid, createSchema, defaultView, type View } from 'tally-core'
import { useViewUrl, type ViewUrlSync } from './use-view-url.ts'

const schema = createSchema({
  columns: [
    { id: 'name' },
    { id: 'status', type: 'enum', options: [{ value: 'active' }, { value: 'churned' }] },
    { id: 'mrr', type: 'currency' },
    { id: 'renewal', type: 'date' },
  ],
})

function makeGrid(view?: View) {
  return createGrid({ schema, source: createArraySource([], schema), view })
}

function visit(search: string): void {
  history.replaceState(null, '', `/accounts${search}#/tab`)
}

function mount(grid = makeGrid(), options?: ViewUrlSync) {
  return renderHook(() => useViewUrl(grid, options))
}

afterEach(() => {
  visit('')
  vi.restoreAllMocks()
})

describe('useViewUrl', () => {
  it('writes the view as readable query text and keeps other params', () => {
    visit('?tab=2')
    const grid = makeGrid()
    mount(grid)
    act(() => {
      grid.view.setFilter({ type: 'condition', column: 'status', op: 'eq', value: 'active' })
      grid.view.setSort([{ column: 'mrr', direction: 'desc' }])
      grid.view.setGroup('renewal', 'month')
      grid.view.setDensity('compact')
    })
    expect(location.search).toBe(
      '?tab=2&q=status+is+active,+sort+by+mrr+desc,+group+by+renewal&granularity=month&density=compact',
    )
    expect(location.pathname).toBe('/accounts')
    expect(location.hash).toBe('#/tab')
  })

  it('restores the url on mount and round trips losslessly', () => {
    const source = makeGrid()
    source.view.setFilter({ type: 'condition', column: 'mrr', op: 'gt', value: 500 })
    source.view.setSort([{ column: 'name', direction: 'asc' }])
    source.view.setGroup('renewal', 'quarter')
    source.view.pinColumn('mrr', 'right')
    source.view.resizeColumn('name', 240)
    source.view.setColumnHidden('renewal', true)
    source.view.moveColumn('status', 0)
    source.view.setFooter('mrr', 'avg')
    source.view.togglePinnedRow(3)
    const writer = mount(source)
    const url = location.search
    writer.unmount()
    visit(url)
    const grid = makeGrid()
    mount(grid)
    expect(grid.view.get()).toEqual(source.view.get())
    expect(location.search).toBe(url)
  })

  it('writes the current view when the url carries none', () => {
    visit('')
    const grid = makeGrid({ ...defaultView(schema), density: 'spacious' })
    mount(grid)
    expect(location.search).toBe('?density=spacious')
  })

  it('restores on popstate and pushes history when asked', () => {
    const push = vi.spyOn(history, 'pushState')
    const grid = makeGrid()
    const hook = mount(grid, { history: 'push', param: 'view' })
    act(() => grid.view.setSort([{ column: 'mrr', direction: 'asc' }]))
    expect(push).toHaveBeenCalledTimes(1)
    expect(location.search).toBe('?view=sort+by+mrr+asc')
    act(() => {
      visit('?view=status+is+churned')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(grid.view.get().filter).toEqual({
      type: 'condition',
      column: 'status',
      op: 'eq',
      value: 'churned',
    })
    expect(grid.view.get().sort).toEqual([])
    expect(push).toHaveBeenCalledTimes(1)
    hook.unmount()
    act(() => grid.view.setDensity('compact'))
    expect(location.search).toBe('?view=status+is+churned')
  })

  it('ignores a malformed url and accepts custom codecs', () => {
    visit('?state=%%%')
    const grid = makeGrid()
    mount(grid)
    expect(grid.view.get()).toEqual(defaultView(schema))
    const custom = makeGrid()
    const encode = vi.fn<(view: View) => string>((view) =>
      view.density === 'compact' ? 'dense' : '',
    )
    const decode = vi.fn<(search: string) => View>((search) => ({
      ...defaultView(schema),
      density: search === 'dense' ? ('compact' as const) : ('comfortable' as const),
    }))
    visit('?dense')
    mount(custom, { encode, decode })
    expect(custom.view.get().density).toBe('compact')
    act(() => custom.view.setDensity('spacious'))
    expect(location.search).toBe('')
  })
})
