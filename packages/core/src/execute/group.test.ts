import { Temporal } from 'temporal-polyfill'
import { describe, expect, it } from 'vitest'
import type { GroupGranularity } from '../query/ast.ts'
import { createSchema } from '../schema/schema.ts'
import { groupValueOf } from './group.ts'

function temporalBucket(value: string, granularity: GroupGranularity): string {
  const date = Temporal.PlainDate.from(value)
  switch (granularity) {
    case 'day':
      return value
    case 'week':
      return date.subtract({ days: date.dayOfWeek - 1 }).toString()
    case 'month':
      return value.slice(0, 7)
    case 'quarter':
      return `${date.year}-Q${Math.floor((date.month - 1) / 3) + 1}`
    case 'year':
      return String(date.year)
  }
}

const granularities: readonly GroupGranularity[] = ['day', 'week', 'month', 'quarter', 'year']

describe('groupValueOf', () => {
  const schema = createSchema({ columns: [{ id: 'renewal', type: 'date' }] })
  const column = schema.requireColumn('renewal')

  it('buckets every day from 1900 to 2200 like Temporal', () => {
    const last = Temporal.PlainDate.from('2200-12-31')
    const mismatches: unknown[] = []
    for (
      let date = Temporal.PlainDate.from('1900-01-01');
      Temporal.PlainDate.compare(date, last) <= 0;
      date = date.add({ days: 1 })
    ) {
      const value = date.toString()
      for (const granularity of granularities) {
        const actual = groupValueOf({ id: 1, renewal: value }, column, schema, granularity)
        const expected = temporalBucket(value, granularity)
        if (actual !== expected) mismatches.push({ value, granularity, actual, expected })
      }
    }
    expect(mismatches).toEqual([])
  })

  it('buckets the edges of the four digit calendar like Temporal', () => {
    for (const value of ['0000-01-01', '0000-01-03', '0001-01-01', '0042-06-15', '9999-12-31']) {
      for (const granularity of granularities) {
        expect(groupValueOf({ id: 1, renewal: value }, column, schema, granularity)).toBe(
          temporalBucket(value, granularity),
        )
      }
    }
  })
})
