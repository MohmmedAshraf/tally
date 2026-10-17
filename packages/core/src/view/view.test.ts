import { describe, expect, it } from 'vitest'
import { TallyError } from '../errors.ts'
import { createSchema } from '../schema/schema.ts'
import { createViewStore } from './store.ts'
import { viewFromUrlString, viewToUrlString } from './url.ts'
import { defaultView, reconcileView, validateFilter, validateView } from './view.ts'

const schema = createSchema({
  columns: [
    { id: 'account', width: 200, pin: 'left' },
    { id: 'plan', type: 'enum', options: [{ value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', type: 'currency', aggregate: 'sum' },
    { id: 'renewal', type: 'date', hidden: true },
  ],
})

describe('defaultView', () => {
  it('derives column state and footer from the schema', () => {
    const view = defaultView(schema)
    expect(view.columns).toEqual([
      { id: 'account', width: 200, pin: 'left' },
      { id: 'plan' },
      { id: 'mrr' },
      { id: 'renewal', hidden: true },
    ])
    expect(view.footer).toEqual({ mrr: 'sum' })
    expect(view.density).toBe('comfortable')
  })
})

describe('validation', () => {
  it('accepts a full view and rejects bad shapes', () => {
    const view = defaultView(schema)
    expect(validateView(view)).toEqual(view)
    expect(() => validateView({ ...view, density: 'huge' })).toThrow(TallyError)
    expect(validateFilter({ type: 'condition', column: 'mrr', op: 'gt', value: 1 })).toEqual({
      type: 'condition',
      column: 'mrr',
      op: 'gt',
      value: 1,
    })
    expect(() => validateFilter({ type: 'condition', column: 'mrr', op: 'nope' })).toThrow(
      'Filter is invalid',
    )
  })

  it('reconciles unknown and missing columns', () => {
    const view = reconcileView(
      {
        ...defaultView(schema),
        columns: [{ id: 'mrr' }, { id: 'ghost' }, { id: 'mrr' }],
        sort: [{ column: 'ghost', direction: 'asc' }],
        group: { column: 'ghost' },
        footer: { ghost: 'sum', account: 'sum', mrr: 'avg' },
      },
      schema,
    )
    expect(view.columns.map((state) => state.id)).toEqual(['account', 'plan', 'mrr', 'renewal'])
    expect(view.sort).toEqual([])
    expect(view.group).toBeUndefined()
    expect(view.footer).toEqual({ mrr: 'avg' })
  })
})

describe('url', () => {
  it('round-trips a view through the url', () => {
    const store = createViewStore(schema)
    store.setFilter({ type: 'condition', column: 'plan', op: 'in', value: ['pro', 'team'] })
    store.setSort([{ column: 'mrr', direction: 'desc' }])
    store.setGroup('plan')
    store.setDensity('compact')
    store.resizeColumn('mrr', 140)
    store.togglePinnedRow(7)
    const url = viewToUrlString(store.get(), schema)
    expect(new URLSearchParams(url).get('q')).toBe(
      'plan in (pro, team), sort by mrr desc, group by plan',
    )
    expect(url).toContain('density=compact')
    expect(url).toContain('columns=account:200:left,plan,mrr:140:0fr,renewal:hidden')
    expect(viewFromUrlString(url, schema)).toEqual(store.get())
  })

  it('keeps granularity, column state and footer readable', () => {
    const store = createViewStore(schema)
    store.setGroup('renewal', 'month')
    store.setColumnHidden('renewal', false)
    store.setColumnHidden('plan', true)
    store.pinColumn('account', undefined)
    store.pinColumn('mrr', 'right')
    store.setColumnFlex('plan', 2)
    store.moveColumn('mrr', 0)
    store.setFooter('mrr', undefined)
    const url = viewToUrlString(store.get(), schema)
    expect(url).toBe(
      'q=group+by+renewal&granularity=month&columns=mrr:right,account:200,plan:2fr:hidden,renewal&footer=',
    )
    const restored = viewFromUrlString(url, schema)
    expect(restored.group).toEqual({ column: 'renewal', granularity: 'month' })
    expect(restored.footer).toEqual({})
    expect(viewToUrlString(restored, schema)).toBe(url)
  })

  it('merges into a base query and honors a custom param', () => {
    const store = createViewStore(schema)
    store.setSort([{ column: 'mrr', direction: 'asc' }])
    const url = viewToUrlString(store.get(), schema, {
      param: 'accounts',
      base: 'tab=2&accounts=plan+is+pro&density=compact',
    })
    expect(url).toBe('tab=2&accounts=sort+by+mrr+asc')
    expect(viewFromUrlString(url, schema, { param: 'accounts' }).sort).toEqual([
      { column: 'mrr', direction: 'asc' },
    ])
  })

  it('omits defaults and tolerates empty or malformed input', () => {
    expect(viewToUrlString(defaultView(schema), schema)).toBe('')
    expect(viewFromUrlString('', schema)).toEqual(defaultView(schema))
    expect(viewFromUrlString('q=mrr+%3E+5', schema).filter).toEqual({
      type: 'condition',
      column: 'mrr',
      op: 'gt',
      value: 5,
    })
    const loose = viewFromUrlString(
      'density=huge&granularity=decade&columns=,mrr:wide:-1fr:left,ghost&footer=mrr:nope,plan:count',
      schema,
    )
    expect(loose.density).toBe('comfortable')
    expect(loose.columns.find((state) => state.id === 'mrr')).toEqual({ id: 'mrr', pin: 'left' })
    expect(loose.footer).toEqual({ plan: 'count' })
  })

  it('escapes separators inside column ids', () => {
    const odd = createSchema({ columns: [{ id: 'a,b:c' }, { id: 'd' }] })
    const store = createViewStore(odd)
    store.moveColumn('d', 0)
    store.setFooter('a,b:c', 'count')
    const url = viewToUrlString(store.get(), odd)
    expect(viewFromUrlString(url, odd)).toEqual(store.get())
  })
})

describe('store', () => {
  it('toggles sort like a spreadsheet header', () => {
    const store = createViewStore(schema)
    store.toggleSort('mrr')
    expect(store.get().sort).toEqual([{ column: 'mrr', direction: 'desc' }])
    store.toggleSort('mrr')
    expect(store.get().sort).toEqual([{ column: 'mrr', direction: 'asc' }])
    store.toggleSort('mrr')
    expect(store.get().sort).toEqual([])
    store.toggleSort('account')
    store.toggleSort('mrr', true)
    expect(store.get().sort).toEqual([
      { column: 'account', direction: 'asc' },
      { column: 'mrr', direction: 'desc' },
    ])
    store.toggleSort('mrr', true)
    expect(store.get().sort[1]).toEqual({ column: 'mrr', direction: 'asc' })
    store.toggleSort('mrr', true)
    expect(store.get().sort).toEqual([{ column: 'account', direction: 'asc' }])
    store.toggleSort('plan')
    expect(store.get().sort).toEqual([{ column: 'plan', direction: 'asc' }])
  })

  it('manages columns, footer, rows and groups', () => {
    const store = createViewStore(schema)
    store.moveColumn('mrr', 0)
    expect(store.get().columns.map((state) => state.id)).toEqual([
      'mrr',
      'account',
      'plan',
      'renewal',
    ])
    store.moveColumn('ghost', 0)
    store.pinColumn('plan', 'right')
    store.setColumnHidden('renewal', false)
    store.setFooter('mrr', 'avg')
    store.setFooter('plan', 'count')
    store.setFooter('mrr', undefined)
    expect(store.get().footer).toEqual({ plan: 'count' })
    expect(store.get().columns.find((state) => state.id === 'plan')?.pin).toBe('right')
    store.setColumnFlex('plan', 1)
    expect(store.get().columns.find((state) => state.id === 'plan')?.flex).toBe(1)
    store.resizeColumn('plan', 180)
    expect(store.get().columns.find((state) => state.id === 'plan')).toEqual({
      id: 'plan',
      pin: 'right',
      width: 180,
      flex: 0,
    })
    store.resizeColumn('plan', undefined)
    expect(store.get().columns.find((state) => state.id === 'plan')).toEqual({
      id: 'plan',
      pin: 'right',
    })
    store.setExpanded('a', true)
    store.setExpanded('a', true)
    store.setExpanded('b', true)
    store.setExpanded('a', false)
    expect(store.get().expanded).toEqual(['b'])
    store.toggleGroupCollapsed('pro')
    store.toggleGroupCollapsed('pro')
    store.toggleGroupCollapsed('team')
    expect(store.get().collapsedGroups).toEqual(['team'])
    store.setRules([{ id: 'r1', column: 'mrr', op: 'lt', value: 0, style: { color: 'red' } }])
    expect(store.get().rules).toHaveLength(1)
    store.reset()
    expect(store.get()).toEqual(defaultView(schema))
  })

  it('notifies subscribers and selectors only on change', () => {
    const store = createViewStore(schema)
    const seen: string[] = []
    const densities: string[] = []
    const stop = store.subscribe((view) => seen.push(view.density))
    const stopSelect = store.select(
      (view) => view.density,
      (density) => densities.push(density),
    )
    store.setDensity('compact')
    store.setSort([])
    store.set({ ...store.get(), density: 'spacious' })
    stop()
    stopSelect()
    store.setDensity('compact')
    expect(seen).toEqual(['compact', 'compact', 'spacious'])
    expect(densities).toEqual(['compact', 'spacious'])
  })
})
