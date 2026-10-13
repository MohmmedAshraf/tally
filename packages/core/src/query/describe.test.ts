import { describe, expect, it } from 'vitest'
import { createFormatContext } from '../format/context.ts'
import { createSchema } from '../schema/schema.ts'
import { and, condition, search } from './ast.ts'
import { describeFilter, topLevelClauses } from './describe.ts'

const schema = createSchema({
  columns: [
    { id: 'plan', label: 'Plan', type: 'enum', options: [{ value: 'pro', label: 'Pro' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
  ],
})
const format = createFormatContext()

describe('describeFilter', () => {
  it('describes conditions with labels, words and formatted values', () => {
    expect(describeFilter(condition('plan', 'in', ['pro', 'team']), schema, format)).toEqual({
      column: 'Plan',
      operator: 'is',
      value: 'Pro, team',
      text: 'plan in (pro, team)',
    })
    expect(describeFilter(condition('mrr', 'gt', 5000), schema, format)).toMatchObject({
      column: 'MRR',
      operator: '>',
      value: '$5,000.00',
    })
    expect(describeFilter(condition('mrr', 'between', [1, 2]), schema, format).value).toBe(
      '$1.00 – $2.00',
    )
    expect(describeFilter(condition('mrr', 'empty'), schema, format)).toMatchObject({
      operator: 'is empty',
      value: undefined,
    })
    expect(
      describeFilter(
        condition('renewal', 'within', { direction: 'last', amount: 30, unit: 'day' }),
        schema,
        format,
      ),
    ).toMatchObject({ column: 'renewal', operator: 'in', value: 'last 30 days' })
  })

  it('falls back to printed text for non conditions and splits top level clauses', () => {
    const text = describeFilter(search('acme'), schema, format)
    expect(text).toEqual({ column: undefined, operator: undefined, value: undefined, text: 'acme' })
    const filter = and(condition('plan', 'eq', 'pro'), search('acme'))
    expect(topLevelClauses(filter)).toHaveLength(2)
    expect(topLevelClauses(condition('plan', 'eq', 'pro'))).toHaveLength(1)
    expect(topLevelClauses(undefined)).toEqual([])
  })
})
