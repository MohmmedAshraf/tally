import { describe, expect, it } from 'vitest'
import { createSchema } from '../schema/schema.ts'
import { defaultView } from '../view/view.ts'
import { clampWidth, layoutColumns } from './columns.ts'

const schema = createSchema({
  columns: [
    { id: 'a', width: 100 },
    { id: 'b', pin: 'right', minWidth: 80 },
    { id: 'c', hidden: true },
    { id: 'd', pin: 'left', width: 120, maxWidth: 200 },
    { id: 'e' },
  ],
})

describe('layoutColumns', () => {
  it('orders left pins, center and right pins and skips hidden columns', () => {
    const layout = layoutColumns(defaultView(schema), schema)
    expect(layout.columns.map((entry) => entry.column.id)).toEqual(['d', 'a', 'e', 'b'])
    expect(layout.left.map((entry) => entry.column.id)).toEqual(['d'])
    expect(layout.right.map((entry) => entry.column.id)).toEqual(['b'])
    expect(layout.columns.map((entry) => entry.index)).toEqual([0, 1, 2, 3])
    expect(layout.totalWidth).toBe(120 + 100 + 160 + 160)
  })

  it('prefers view widths and ignores unknown columns', () => {
    const view = defaultView(schema)
    const layout = layoutColumns(
      { ...view, columns: [{ id: 'ghost' }, { id: 'a', width: 300 }, { id: 'd', width: 1000 }] },
      schema,
    )
    expect(layout.columns.map((entry) => [entry.column.id, entry.width])).toEqual([
      ['a', 300],
      ['d', 200],
    ])
  })

  it('clamps widths to column bounds', () => {
    expect(clampWidth({ id: 'x', type: 'text', minWidth: 80 }, 10)).toBe(80)
    expect(clampWidth({ id: 'x', type: 'text' }, 10)).toBe(48)
    expect(clampWidth({ id: 'x', type: 'text', maxWidth: 90 }, 400.6)).toBe(90)
  })
})
