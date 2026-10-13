import { describe, expect, it } from 'vitest'
import { createSchema } from '../schema/schema.ts'
import type { Query } from './ast.ts'
import { parseQuery } from './parse.ts'
import { printQuery } from './print.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account', aliases: ['customer'] },
    { id: 'owner', label: 'Account Owner', type: 'person', options: [{ value: 'Ada Okafor' }] },
    {
      id: 'plan',
      type: 'enum',
      options: [
        { value: 'free' },
        { value: 'pro', label: 'Pro' },
        { value: 'team', label: 'Team' },
      ],
    },
    {
      id: 'status',
      type: 'enum',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'past_due', label: 'Past due' },
        { value: 'in_review', label: 'In review' },
      ],
    },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'seats', type: 'int' },
    { id: 'growth', type: 'percent' },
    { id: 'renewal', type: 'date' },
    { id: 'trial', type: 'bool' },
    { id: 'notes', sortable: false, groupable: false },
  ],
})

interface Golden {
  readonly text: string
  readonly query: Query
  readonly canonical: string
}

const corpus: readonly Golden[] = [
  {
    text: 'status is active',
    query: { filter: { type: 'condition', column: 'status', op: 'eq', value: 'active' }, sort: [] },
    canonical: 'status is active',
  },
  {
    text: 'Status: Past due',
    query: {
      filter: { type: 'condition', column: 'status', op: 'eq', value: 'past_due' },
      sort: [],
    },
    canonical: 'status is past_due',
  },
  {
    text: 'status is in review',
    query: {
      filter: { type: 'condition', column: 'status', op: 'eq', value: 'in_review' },
      sort: [],
    },
    canonical: 'status is in_review',
  },
  {
    text: 'status is not past due and mrr > 2k',
    query: {
      filter: {
        type: 'and',
        filters: [
          { type: 'condition', column: 'status', op: 'neq', value: 'past_due' },
          { type: 'condition', column: 'mrr', op: 'gt', value: 2000 },
        ],
      },
      sort: [],
    },
    canonical: 'status is not past_due and mrr > 2000',
  },
  {
    text: 'plan is pro or team',
    query: {
      filter: { type: 'condition', column: 'plan', op: 'in', value: ['pro', 'team'] },
      sort: [],
    },
    canonical: 'plan in (pro, team)',
  },
  {
    text: 'plan in (pro, team)',
    query: {
      filter: { type: 'condition', column: 'plan', op: 'in', value: ['pro', 'team'] },
      sort: [],
    },
    canonical: 'plan in (pro, team)',
  },
  {
    text: 'plan is pro or plan is team',
    query: {
      filter: { type: 'condition', column: 'plan', op: 'in', value: ['pro', 'team'] },
      sort: [],
    },
    canonical: 'plan in (pro, team)',
  },
  {
    text: 'plan is pro or mrr > 5',
    query: {
      filter: {
        type: 'or',
        filters: [
          { type: 'condition', column: 'plan', op: 'eq', value: 'pro' },
          { type: 'condition', column: 'mrr', op: 'gt', value: 5 },
        ],
      },
      sort: [],
    },
    canonical: 'plan is pro or mrr > 5',
  },
  {
    text: 'mrr 2k..10k',
    query: {
      filter: { type: 'condition', column: 'mrr', op: 'between', value: [2000, 10000] },
      sort: [],
    },
    canonical: 'mrr between 2000 and 10000',
  },
  {
    text: 'mrr between 10k and 2k',
    query: {
      filter: { type: 'condition', column: 'mrr', op: 'between', value: [2000, 10000] },
      sort: [],
    },
    canonical: 'mrr between 2000 and 10000',
  },
  {
    text: 'seats at least 5',
    query: { filter: { type: 'condition', column: 'seats', op: 'gte', value: 5 }, sort: [] },
    canonical: 'seats >= 5',
  },
  {
    text: 'growth under -3.5%',
    query: { filter: { type: 'condition', column: 'growth', op: 'lt', value: -3.5 }, sort: [] },
    canonical: 'growth < -3.5',
  },
  {
    text: 'mrr is empty',
    query: { filter: { type: 'condition', column: 'mrr', op: 'empty' }, sort: [] },
    canonical: 'mrr is empty',
  },
  {
    text: 'owner is not empty',
    query: { filter: { type: 'condition', column: 'owner', op: 'notEmpty' }, sort: [] },
    canonical: 'owner is not empty',
  },
  {
    text: 'renewal last 30 days',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'within',
        value: { direction: 'last', amount: 30, unit: 'day' },
      },
      sort: [],
    },
    canonical: 'renewal in last 30 days',
  },
  {
    text: 'renewal in next 2 weeks',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'within',
        value: { direction: 'next', amount: 2, unit: 'week' },
      },
      sort: [],
    },
    canonical: 'renewal in next 2 weeks',
  },
  {
    text: 'renewal is today',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'within',
        value: { direction: 'this', amount: 1, unit: 'day' },
      },
      sort: [],
    },
    canonical: 'renewal in today',
  },
  {
    text: 'renewal yesterday',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'within',
        value: { direction: 'this', amount: 1, unit: 'day', shift: -1 },
      },
      sort: [],
    },
    canonical: 'renewal in yesterday',
  },
  {
    text: 'renewal this quarter',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'within',
        value: { direction: 'this', amount: 1, unit: 'quarter' },
      },
      sort: [],
    },
    canonical: 'renewal in this quarter',
  },
  {
    text: 'renewal is 2026-01',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'between',
        value: ['2026-01-01', '2026-01-31'],
      },
      sort: [],
    },
    canonical: 'renewal between 2026-01-01 and 2026-01-31',
  },
  {
    text: 'renewal after 2025',
    query: {
      filter: { type: 'condition', column: 'renewal', op: 'gt', value: '2025-12-31' },
      sort: [],
    },
    canonical: 'renewal > 2025-12-31',
  },
  {
    text: 'renewal between 2026-02 and 2026-03',
    query: {
      filter: {
        type: 'condition',
        column: 'renewal',
        op: 'between',
        value: ['2026-02-01', '2026-03-31'],
      },
      sort: [],
    },
    canonical: 'renewal between 2026-02-01 and 2026-03-31',
  },
  {
    text: 'renewal before 2026-03-01',
    query: {
      filter: { type: 'condition', column: 'renewal', op: 'lt', value: '2026-03-01' },
      sort: [],
    },
    canonical: 'renewal < 2026-03-01',
  },
  {
    text: 'trial is yes',
    query: { filter: { type: 'condition', column: 'trial', op: 'eq', value: true }, sort: [] },
    canonical: 'trial is true',
  },
  {
    text: 'account contains acme',
    query: {
      filter: { type: 'condition', column: 'account', op: 'contains', value: 'acme' },
      sort: [],
    },
    canonical: 'account contains acme',
  },
  {
    text: 'customer acme corp',
    query: {
      filter: { type: 'condition', column: 'account', op: 'contains', value: 'acme corp' },
      sort: [],
    },
    canonical: 'account contains "acme corp"',
  },
  {
    text: 'account starts with "North" and account does not contain labs',
    query: {
      filter: {
        type: 'and',
        filters: [
          { type: 'condition', column: 'account', op: 'startsWith', value: 'North' },
          { type: 'condition', column: 'account', op: 'notContains', value: 'labs' },
        ],
      },
      sort: [],
    },
    canonical: 'account starts with North and account does not contain labs',
  },
  {
    text: 'account owner is ada',
    query: {
      filter: { type: 'condition', column: 'owner', op: 'eq', value: 'Ada Okafor' },
      sort: [],
    },
    canonical: 'owner is "Ada Okafor"',
  },
  {
    text: 'acme',
    query: { filter: { type: 'search', text: 'acme' }, sort: [] },
    canonical: 'acme',
  },
  {
    text: 'acme corp, status is active',
    query: {
      filter: {
        type: 'and',
        filters: [
          { type: 'search', text: 'acme corp' },
          { type: 'condition', column: 'status', op: 'eq', value: 'active' },
        ],
      },
      sort: [],
    },
    canonical: '"acme corp" and status is active',
  },
  {
    text: 'status',
    query: { filter: { type: 'search', text: 'status' }, sort: [] },
    canonical: '"status"',
  },
  {
    text: 'not status is active',
    query: {
      filter: { type: 'condition', column: 'status', op: 'neq', value: 'active' },
      sort: [],
    },
    canonical: 'status is not active',
  },
  {
    text: 'not (status is active and mrr > 5)',
    query: {
      filter: {
        type: 'not',
        filter: {
          type: 'and',
          filters: [
            { type: 'condition', column: 'status', op: 'eq', value: 'active' },
            { type: 'condition', column: 'mrr', op: 'gt', value: 5 },
          ],
        },
      },
      sort: [],
    },
    canonical: 'not (status is active and mrr > 5)',
  },
  {
    text: '(plan is free or mrr < 100) and status is active',
    query: {
      filter: {
        type: 'and',
        filters: [
          {
            type: 'or',
            filters: [
              { type: 'condition', column: 'plan', op: 'eq', value: 'free' },
              { type: 'condition', column: 'mrr', op: 'lt', value: 100 },
            ],
          },
          { type: 'condition', column: 'status', op: 'eq', value: 'active' },
        ],
      },
      sort: [],
    },
    canonical: '(plan is free or mrr < 100) and status is active',
  },
  {
    text: 'is:changed',
    query: { filter: { type: 'flag', name: 'changed' }, sort: [] },
    canonical: 'is:changed',
  },
  {
    text: 'sort by mrr',
    query: { sort: [{ column: 'mrr', direction: 'desc' }] },
    canonical: 'sort by mrr desc',
  },
  {
    text: 'order by account',
    query: { sort: [{ column: 'account', direction: 'asc' }] },
    canonical: 'sort by account asc',
  },
  {
    text: 'status is active sort by renewal asc group by plan',
    query: {
      filter: { type: 'condition', column: 'status', op: 'eq', value: 'active' },
      sort: [{ column: 'renewal', direction: 'asc' }],
      group: { column: 'plan' },
    },
    canonical: 'status is active, sort by renewal asc, group by plan',
  },
  {
    text: '',
    query: { sort: [] },
    canonical: '',
  },
]

describe('query corpus', () => {
  it.each(corpus)('parses $text', ({ text, query, canonical }) => {
    const result = parseQuery(text, schema)
    expect(result.errors).toEqual([])
    expect(result.query).toEqual(query)
    expect(printQuery(result.query, schema)).toBe(canonical)
  })

  it.each(corpus)('round-trips $canonical', ({ canonical, query }) => {
    const again = parseQuery(canonical, schema)
    expect(again.errors).toEqual([])
    expect(again.query).toEqual(query)
    expect(printQuery(again.query, schema)).toBe(canonical)
  })
})

describe('clauses', () => {
  it('splits top-level and clauses with spans', () => {
    const text = 'status is active, mrr > 2k sort by mrr'
    const result = parseQuery(text, schema)
    expect(result.clauses.map((clause) => [clause.kind, clause.text])).toEqual([
      ['filter', 'status is active'],
      ['filter', 'mrr > 2k'],
      ['sort', 'sort by mrr'],
    ])
    const second = result.clauses[1]
    expect(text.slice(second?.start, second?.end)).toBe('mrr > 2k')
  })

  it('keeps a top-level or as one clause', () => {
    const result = parseQuery('plan is free or mrr < 100', schema)
    expect(result.clauses).toHaveLength(1)
    expect(result.clauses[0]?.kind).toBe('filter')
  })
})

describe('errors', () => {
  it('reports unknown enum values with a position', () => {
    const result = parseQuery('status is gone', schema)
    expect(result.errors).toEqual([
      { message: '"gone" is not a status option', offset: 10, length: 4 },
    ])
    expect(result.query.filter).toBeUndefined()
    expect(result.clauses[0]?.kind).toBe('invalid')
  })

  it('keeps valid clauses when one is invalid', () => {
    const result = parseQuery('status is active and mrr > abc', schema)
    expect(result.errors.map((error) => error.message)).toEqual(['"abc" is not a number'])
    expect(result.query.filter).toEqual({
      type: 'condition',
      column: 'status',
      op: 'eq',
      value: 'active',
    })
  })

  it('reports unsupported operators', () => {
    expect(parseQuery('status > 5', schema).errors[0]?.message).toBe('status does not support "gt"')
    expect(parseQuery('account last 3 days', schema).errors[0]?.message).toBe(
      'Account does not support "within"',
    )
  })

  it('reports incomplete input at the end', () => {
    const result = parseQuery('mrr >', schema)
    expect(result.errors[0]).toMatchObject({ offset: 5, length: 0 })
  })

  it('reports directives on columns that disallow them', () => {
    expect(parseQuery('sort by notes', schema).errors[0]?.message).toBe('notes cannot be sorted')
    expect(parseQuery('group by mrr', schema).errors[0]?.message).toBe('MRR cannot be grouped')
  })

  it('reports stray characters', () => {
    const result = parseQuery('mrr > 5 ^', schema)
    expect(result.errors[0]?.message).toBe('Unexpected "^"')
  })
})
