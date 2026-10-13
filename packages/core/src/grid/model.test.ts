import { describe, expect, it } from 'vitest'
import { createSchema } from '../schema/schema.ts'
import { defaultView } from '../view/view.ts'
import { buildRowModel } from './model.ts'

const schema = createSchema({
  columns: [
    { id: 'name' },
    { id: 'plan', type: 'enum', options: [{ value: 'a' }, { value: 'b' }] },
  ],
})

const rows = [
  { id: 1, name: 'One', plan: 'a' },
  { id: 2, name: 'Two', plan: 'b' },
  { id: 3, name: 'Three', plan: 'a' },
  { id: 4, name: 'Four', plan: null },
]

describe('buildRowModel', () => {
  it('lists flat rows with positions and indexes', () => {
    const model = buildRowModel({ rows, view: defaultView(schema), schema })
    expect(model.items).toHaveLength(4)
    expect(model.rows.map((item) => [item.key, item.index, item.position])).toEqual([
      [1, 0, 1],
      [2, 1, 2],
      [3, 2, 3],
      [4, 3, 4],
    ])
    expect(model.groups).toEqual([])
    const paged = buildRowModel({ rows, view: defaultView(schema), schema, offset: 200 })
    expect(paged.rows.map((item) => item.position)).toEqual([201, 202, 203, 204])
  })

  it('groups rows in order, restarts positions and respects collapsed groups', () => {
    const view = { ...defaultView(schema), group: { column: 'plan' }, collapsedGroups: ['b'] }
    const model = buildRowModel({
      rows: [rows[0]!, rows[2]!, rows[1]!, rows[3]!],
      view,
      schema,
      groups: [{ key: 'a', value: 'a', count: 2, aggregates: { 'x:count': 2 } }],
    })
    expect(model.items.map((item) => (item.kind === 'group' ? `#${item.key}` : item.key))).toEqual([
      '#a',
      1,
      3,
      '#b',
      '#',
      4,
    ])
    expect(model.groups.map((group) => [group.key, group.count, group.collapsed])).toEqual([
      ['a', 2, false],
      ['b', 1, true],
      ['', 1, false],
    ])
    expect(model.groups[0]?.aggregates).toEqual({ 'x:count': 2 })
    expect(model.rows.map((item) => [item.index, item.position, item.group])).toEqual([
      [0, 1, 'a'],
      [1, 2, 'a'],
      [2, 1, ''],
    ])
  })

  it('lifts pinned rows to the top and out of their groups', () => {
    const view = { ...defaultView(schema), group: { column: 'plan' }, pinnedRows: [3] }
    const model = buildRowModel({ rows, view, schema })
    expect(model.pinned.map((item) => item.key)).toEqual([3])
    expect(model.items[0]).toMatchObject({ kind: 'row', key: 3, pinned: true, index: 0 })
    expect(model.rows.filter((item) => item.key === 3)).toHaveLength(1)
    expect(model.groups.find((group) => group.key === 'a')?.count).toBe(2)
  })

  it('flattens trees according to the expanded keys', () => {
    const tree = createSchema({ columns: [{ id: 'name' }], parent: 'parent' })
    const data = [
      { id: 'root', name: 'Root', parent: null },
      { id: 'child', name: 'Child', parent: 'root' },
      { id: 'leaf', name: 'Leaf', parent: 'child' },
    ]
    const closed = buildRowModel({ rows: data, view: defaultView(tree), schema: tree })
    expect(closed.rows.map((item) => item.key)).toEqual(['root'])
    expect(closed.rows[0]).toMatchObject({ hasChildren: true, expanded: false, depth: 0 })
    const open = buildRowModel({
      rows: data,
      view: { ...defaultView(tree), expanded: ['root'] },
      schema: tree,
    })
    expect(open.rows.map((item) => [item.key, item.depth])).toEqual([
      ['root', 0],
      ['child', 1],
    ])
  })
})
