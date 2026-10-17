import { describe, expect, it } from 'vitest'
import { createSchema } from '../schema/index.ts'
import { createArraySource } from '../source/index.ts'
import { holdGrid } from './hold.ts'

const schema = createSchema({ columns: [{ id: 'name' }] })
const source = createArraySource([{ id: 1, name: 'One' }], schema)

describe('holdGrid', () => {
  it('keeps the grid while schema, source and format are unchanged', () => {
    const held = holdGrid({ schema, source })
    expect(holdGrid({ schema, source }, held)).toBe(held)
  })

  it('recreates the grid and keeps the view when the source changes', () => {
    const held = holdGrid({ schema, source })
    held.grid.view.setSort([{ column: 'name', direction: 'desc' }])
    const next = holdGrid({ schema, source: createArraySource([], schema) }, held)
    expect(next).not.toBe(held)
    expect(next.grid.view.get().sort).toEqual([{ column: 'name', direction: 'desc' }])
  })

  it('recreates the grid when the format changes', () => {
    const held = holdGrid({ schema, source, today: '2026-01-01' })
    expect(holdGrid({ schema, source, today: '2026-01-02' }, held)).not.toBe(held)
    const format = { locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' }
    const formatted = holdGrid({ schema, source, format }, held)
    expect(formatted).not.toBe(held)
    expect(holdGrid({ schema, source, format: { ...format } }, formatted)).toBe(formatted)
  })
})
