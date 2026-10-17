import { describe, expect, it } from 'vitest'
import { createStressRows, createStressSchema } from '../test/stress.ts'
import { createExecutionContext } from './context.ts'
import { compileSort, sortRows } from './sort.ts'

describe('sortRows', () => {
  const schema = createStressSchema()
  const rows = createStressRows(3000, 5)
  const context = createExecutionContext()

  it.each([
    [[{ column: 'date1', direction: 'desc' }]],
    [
      [
        { column: 'enum2', direction: 'asc' },
        { column: 'currency1', direction: 'desc' },
      ],
    ],
    [
      [
        { column: 'notes', direction: 'asc' },
        { column: 'flag1', direction: 'desc' },
      ],
    ],
    [
      [
        { column: 'person1', direction: 'desc' },
        { column: 'missing', direction: 'asc' },
      ],
    ],
  ] as const)('orders exactly like a stable comparator sort for %j', (sorts) => {
    const comparator = compileSort(sorts, schema, context)!
    expect(sortRows(rows, sorts, schema, context)).toEqual(rows.toSorted(comparator))
  })

  it('returns the input untouched without sort keys', () => {
    expect(sortRows(rows, [{ column: 'missing', direction: 'asc' }], schema, context)).toBe(rows)
  })
})
