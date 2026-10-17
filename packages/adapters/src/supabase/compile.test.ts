import { createSchema, type Condition, type Filter } from 'tally-core'
import { CONFORMANCE_TODAY, conformanceSchema } from 'tally-protocol'
import { describe, expect, it } from 'vitest'
import { createCompiler } from './compile.ts'

const compiler = createCompiler({ schema: conformanceSchema, today: CONFORMANCE_TODAY, key: 'id' })

function where(filter: Filter): string {
  return compiler.filter(filter)
}

function condition(column: string, op: Condition['op'], value: unknown): Filter {
  return { type: 'condition', column, op, value }
}

describe('postgrest compiler operators', () => {
  it('compiles comparisons and ranges per column kind', () => {
    expect(where(condition('mrr', 'lt', '12'))).toBe('mrr.lt.12')
    expect(where(condition('mrr', 'gte', 3))).toBe('mrr.gte.3')
    expect(where(condition('renewal', 'lte', '2026-01-01'))).toBe('renewal.lte."2026-01-01"')
    expect(where(condition('plan', 'eq', 'pro'))).toBe('plan.eq."pro"')
    expect(where(condition('active', 'eq', false))).toBe('active.is.false')
    expect(where(condition('mrr', 'between', 5))).toBe('and(mrr.gte.NaN,mrr.lte.NaN)')
  })

  it('compiles text patterns', () => {
    expect(where(condition('account', 'startsWith', 'Ac'))).toBe('account.ilike."ac%"')
    expect(where(condition('account', 'endsWith', 'ME'))).toBe('account.ilike."%me"')
    expect(where(condition('account', 'notContains', 'x'))).toBe(
      'or(account.is.null,account.eq."",account.not.ilike."%x%")',
    )
  })

  it('compiles membership including empty and scalar lists', () => {
    expect(where(condition('plan', 'in', []))).toBe('id.is.null')
    expect(where(condition('plan', 'notIn', []))).toBe('or(plan.is.null,plan.eq."",id.not.is.null)')
    expect(where(condition('plan', 'notIn', ['free', 'pro']))).toBe(
      'or(plan.is.null,plan.eq."",plan.not.in.("free","pro"))',
    )
    expect(where(condition('owner', 'notIn', ['Mona', 'Ali']))).toBe(
      'or(owner.is.null,owner.eq."",and(owner.not.ilike."mona",owner.not.ilike."ali"))',
    )
    expect(where(condition('seats', 'in', 3))).toBe('seats.in.(3)')
  })

  it('compiles emptiness for string and scalar columns', () => {
    expect(where(condition('plan', 'empty', undefined))).toBe('or(plan.is.null,plan.eq."")')
    expect(where(condition('plan', 'notEmpty', undefined))).toBe(
      'and(plan.not.is.null,plan.neq."")',
    )
    expect(where(condition('seats', 'notEmpty', undefined))).toBe('seats.not.is.null')
    expect(where({ type: 'not', filter: condition('plan', 'empty', undefined) })).toBe(
      'and(plan.not.is.null,plan.neq."")',
    )
  })

  it('negates ranges, relative dates and booleans', () => {
    expect(where({ type: 'not', filter: condition('mrr', 'between', [1, 2]) })).toBe(
      'or(mrr.is.null,mrr.not.gte.1,mrr.not.lte.2)',
    )
    expect(where({ type: 'not', filter: condition('active', 'eq', true) })).toBe(
      'or(active.is.null,active.not.is.true)',
    )
    expect(where(condition('renewal', 'within', 'soon'))).toBe('id.is.null')
    expect(where({ type: 'not', filter: condition('renewal', 'within', 'soon') })).toBe(
      'or(renewal.is.null,id.not.is.null)',
    )
  })

  it('treats unknown columns and flags as constant predicates', () => {
    expect(where(condition('missing', 'eq', 1))).toBe('id.is.null')
    expect(where({ type: 'not', filter: condition('missing', 'eq', 1) })).toBe('id.not.is.null')
    expect(where({ type: 'flag', name: 'starred' })).toBe('id.is.null')
    expect(where({ type: 'not', filter: { type: 'flag', name: 'starred' } })).toBe('id.not.is.null')
  })

  it('compiles empty and nested boolean groups', () => {
    expect(where({ type: 'and', filters: [] })).toBe('id.not.is.null')
    expect(where({ type: 'or', filters: [] })).toBe('id.is.null')
    expect(where({ type: 'not', filter: { type: 'and', filters: [] } })).toBe('id.is.null')
    expect(where({ type: 'not', filter: { type: 'or', filters: [] } })).toBe('id.not.is.null')
    expect(
      where({
        type: 'or',
        filters: [
          condition('seats', 'gt', 1),
          { type: 'or', filters: [condition('seats', 'lt', 0), condition('mrr', 'eq', 0)] },
        ],
      }),
    ).toBe('or(seats.gt.1,seats.lt.0,mrr.eq.0)')
    expect(
      where({
        type: 'not',
        filter: { type: 'or', filters: [condition('seats', 'gt', 1), condition('mrr', 'eq', 0)] },
      }),
    ).toBe('and(or(seats.is.null,seats.not.gt.1),or(mrr.is.null,mrr.neq.0))')
  })

  it('compiles search across searchable string columns', () => {
    expect(where({ type: 'search', text: '  ' })).toBe('id.not.is.null')
    expect(where({ type: 'not', filter: { type: 'search', text: '' } })).toBe('id.is.null')
    expect(where({ type: 'search', text: 'Ac' })).toBe(
      'or(id.ilike."%ac%",account.ilike."%ac%",owner.ilike."%ac%",plan.ilike."%ac%",email.ilike."%ac%",website.ilike."%ac%")',
    )
    const numeric = createCompiler({
      schema: createSchema({ columns: [{ id: 'n', type: 'number' }], key: 'n' }),
      today: CONFORMANCE_TODAY,
      key: 'n',
    })
    expect(numeric.filter({ type: 'search', text: 'x' })).toBe('n.is.null')
    expect(numeric.filter({ type: 'not', filter: { type: 'search', text: 'x' } })).toBe(
      'n.not.is.null',
    )
  })
})

describe('postgrest compiler naming', () => {
  const schema = createSchema({
    columns: [
      { id: 'name', type: 'text' },
      { id: 'size', type: 'int' },
    ],
    key: 'uid',
  })
  const mapped = createCompiler({
    schema,
    today: CONFORMANCE_TODAY,
    key: 'uid',
    columns: { name: 'full_name', uid: 'user_id' },
  })

  it('maps column names and selects the key alongside the columns', () => {
    expect(mapped.name('name')).toBe('full_name')
    expect(mapped.name('size')).toBe('size')
    expect(mapped.selection()).toBe('name:full_name,size,uid:user_id')
    expect(mapped.filter(condition('name', 'eq', 'Ann'))).toBe('full_name.ilike."ann"')
    expect(mapped.filter(condition('size', 'in', []))).toBe('user_id.is.null')
    const plain = createCompiler({ schema, today: CONFORMANCE_TODAY, key: 'uid' })
    expect(plain.selection()).toBe('name,size,uid')
  })

  it('orders by known columns and always breaks ties by key', () => {
    expect(
      mapped.order([
        { column: 'name', direction: 'asc' },
        { column: 'missing', direction: 'desc' },
        { column: 'size', direction: 'desc' },
      ]),
    ).toEqual([
      { column: 'full_name', ascending: true },
      { column: 'size', ascending: false },
      { column: 'user_id', ascending: true },
    ])
  })
})
