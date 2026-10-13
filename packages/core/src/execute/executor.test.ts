import { describe, expect, it } from 'vitest'
import { parseQuery } from '../query/parse.ts'
import { createSchema } from '../schema/schema.ts'
import { createExecutionContext } from './context.ts'
import { execute } from './executor.ts'
import { flattenTree } from './tree.ts'

const schema = createSchema({
  columns: [
    { id: 'account' },
    { id: 'owner', type: 'person' },
    {
      id: 'plan',
      type: 'enum',
      options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }],
    },
    {
      id: 'status',
      type: 'enum',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'past_due', label: 'Past due' },
      ],
    },
    { id: 'mrr', type: 'currency' },
    { id: 'seats', type: 'int' },
    { id: 'renewal', type: 'date' },
    { id: 'trial', type: 'bool' },
  ],
})

const rows = [
  {
    id: 1,
    account: 'North Labs',
    owner: 'Ada',
    plan: 'pro',
    status: 'active',
    mrr: 1200,
    seats: 10,
    renewal: '2026-11-02',
    trial: false,
  },
  {
    id: 2,
    account: 'Blue Works',
    owner: 'Bruno',
    plan: 'team',
    status: 'past_due',
    mrr: 3900,
    seats: 40,
    renewal: '2026-10-20',
    trial: false,
  },
  {
    id: 3,
    account: 'Iron Cloud',
    owner: 'Ada',
    plan: 'free',
    status: 'active',
    mrr: 0,
    seats: 2,
    renewal: '2027-01-15',
    trial: true,
  },
  {
    id: 4,
    account: 'Quiet Bank',
    owner: null,
    plan: 'pro',
    status: 'active',
    mrr: 1500,
    seats: null,
    renewal: null,
    trial: false,
  },
  {
    id: 5,
    account: 'cedar foods',
    owner: 'Chen',
    plan: 'team',
    status: 'active',
    mrr: 5200,
    seats: 55,
    renewal: '2026-10-14',
    trial: false,
  },
]

const today = '2026-10-13'

function run(text: string, extra: Parameters<typeof execute>[1] = {}) {
  const parsed = parseQuery(text, schema)
  expect(parsed.errors).toEqual([])
  return execute(rows, { ...parsed.query, ...extra }, schema, { today })
}

function ids(result: { rows: readonly { id?: unknown }[] }): unknown[] {
  return result.rows.map((row) => row.id)
}

describe('filtering', () => {
  it.each([
    ['status is active', [1, 3, 4, 5]],
    ['status is not active', [2]],
    ['plan is pro or team', [1, 2, 4, 5]],
    ['plan not in (pro, team)', [3]],
    ['mrr > 1200', [2, 4, 5]],
    ['mrr >= 1200', [1, 2, 4, 5]],
    ['mrr between 1k and 2k', [1, 4]],
    ['mrr 5000..1000', [1, 2, 4]],
    ['seats < 20', [1, 3]],
    ['seats is empty', [4]],
    ['owner is not empty', [1, 2, 3, 5]],
    ['account contains labs', [1]],
    ['account starts with Q', [4]],
    ['account ends with S', [1, 2, 5]],
    ['account does not contain o', [4]],
    ['account is "cedar foods"', [5]],
    ['owner is ada', [1, 3]],
    ['renewal last 30 days', []],
    ['renewal next 30 days', [1, 2, 5]],
    ['renewal next 2 weeks', [2, 5]],
    ['renewal next 1 month', [1, 2, 5]],
    ['renewal this year', [1, 2, 5]],
    ['renewal is 2026-10', [2, 5]],
    ['renewal after 2026-10-20', [1, 3]],
    ['renewal before 2026-10-20', [5]],
    ['renewal is empty', [4]],
    ['renewal in tomorrow', [5]],
    ['trial is yes', [3]],
    ['trial is not yes', [1, 2, 4, 5]],
    ['labs', [1]],
    ['past due', [2]],
    ['ada', [1, 3]],
    ['not (plan is pro or status is active)', [2]],
    ['plan is team and (mrr > 5000 or seats < 50)', [2, 5]],
    ['', [1, 2, 3, 4, 5]],
  ])('%s', (text, expected) => {
    expect(ids(run(text))).toEqual(expected)
  })

  it('resolves flags through the context', () => {
    const parsed = parseQuery('is:changed', schema)
    const result = execute(rows, parsed.query, schema, {
      today,
      flags: (name, row) => name === 'changed' && row['id'] === 2,
    })
    expect(ids(result)).toEqual([2])
    expect(result.matched).toBe(1)
    expect(result.total).toBe(5)
  })

  it('ignores unknown columns in programmatic filters', () => {
    const result = execute(
      rows,
      { filter: { type: 'condition', column: 'nope', op: 'eq', value: 1 } },
      schema,
    )
    expect(result.rows).toEqual([])
  })
})

describe('sorting', () => {
  it('sorts with empties last and multiple keys', () => {
    expect(ids(run('sort by mrr'))).toEqual([5, 2, 4, 1, 3])
    expect(ids(run('sort by seats asc'))).toEqual([3, 1, 2, 5, 4])
    expect(ids(run('sort by owner asc, sort by mrr desc'))).toEqual([1, 3, 2, 5, 4])
    expect(ids(run('sort by owner asc, sort by mrr asc'))).toEqual([3, 1, 2, 5, 4])
    expect(ids(run('sort by renewal'))).toEqual([3, 1, 2, 5, 4])
    expect(ids(run('sort by plan asc'))).toEqual([3, 1, 4, 2, 5])
    expect(ids(run('sort by account asc'))).toEqual([2, 5, 3, 1, 4])
  })
})

describe('grouping and aggregates', () => {
  it('groups in option order with per-group aggregates', () => {
    const result = run('group by plan', {
      aggregates: [
        { column: 'mrr', fn: 'sum' },
        { column: 'seats', fn: 'avg' },
        { column: 'account', fn: 'count' },
        { column: 'owner', fn: 'distinct' },
        { column: 'renewal', fn: 'min' },
        { column: 'renewal', fn: 'max' },
        { column: 'account', fn: 'sum' },
      ],
    })
    expect(result.groups?.map((group) => [group.key, group.rows.length])).toEqual([
      ['free', 1],
      ['pro', 2],
      ['team', 2],
    ])
    expect(result.groups?.[1]?.aggregates).toEqual({
      'mrr:sum': 2700,
      'seats:avg': 10,
      'account:count': 2,
      'owner:distinct': 1,
      'renewal:min': '2026-11-02',
      'renewal:max': '2026-11-02',
    })
    expect(result.aggregates).toEqual({
      'mrr:sum': 11800,
      'seats:avg': 26.75,
      'account:count': 5,
      'owner:distinct': 3,
      'renewal:min': '2026-10-14',
      'renewal:max': '2027-01-15',
    })
    expect(ids(result)).toEqual([3, 1, 4, 2, 5])
  })

  it('groups dates by month newest first and empties last', () => {
    const result = run('group by renewal')
    expect(result.groups?.map((group) => group.key)).toEqual(['2027-01', '2026-11', '2026-10', ''])
    const byYear = execute(rows, { group: { column: 'renewal', granularity: 'year' } }, schema)
    expect(byYear.groups?.map((group) => group.key)).toEqual(['2027', '2026', ''])
    const byQuarter = execute(
      rows,
      { group: { column: 'renewal', granularity: 'quarter' } },
      schema,
    )
    expect(byQuarter.groups?.map((group) => group.key)).toEqual(['2027-Q1', '2026-Q4', ''])
    const byWeek = execute(rows, { group: { column: 'renewal', granularity: 'week' } }, schema)
    expect(byWeek.groups?.[0]?.key).toBe('2027-01-11')
  })

  it('follows an explicit sort on the grouped column', () => {
    const result = run('group by plan sort by plan desc')
    expect(result.groups?.map((group) => group.key)).toEqual(['team', 'pro', 'free'])
  })

  it('returns an average of nothing as undefined', () => {
    const result = execute([], { aggregates: [{ column: 'mrr', fn: 'avg' }] }, schema)
    expect(result.aggregates).toEqual({ 'mrr:avg': undefined })
  })
})

describe('facets and paging', () => {
  it('computes histograms and terms on the filtered rows', () => {
    const result = run('status is active', { facets: ['mrr', 'plan', 'renewal', 'account'] })
    const mrr = result.facets?.['mrr']
    expect(mrr?.kind).toBe('histogram')
    if (mrr?.kind === 'histogram') {
      expect(mrr.min).toBe(0)
      expect(mrr.max).toBe(5200)
      expect(mrr.bins).toHaveLength(20)
      expect(mrr.bins.reduce((total, bin) => total + bin.count, 0)).toBe(4)
    }
    expect(result.facets?.['plan']).toEqual({
      kind: 'terms',
      distinct: 3,
      terms: [
        { value: 'free', count: 1 },
        { value: 'pro', count: 2 },
        { value: 'team', count: 1 },
      ],
    })
    const renewal = result.facets?.['renewal']
    if (renewal?.kind === 'histogram') {
      expect(renewal.min).toBe('2026-10-14')
      expect(renewal.max).toBe('2027-01-15')
    }
    expect(result.facets?.['account']).toBeUndefined()
  })

  it('handles single-valued histograms', () => {
    const result = execute(rows.slice(0, 1), { facets: ['mrr'] }, schema)
    const facet = result.facets?.['mrr']
    if (facet?.kind === 'histogram') expect(facet.bins[0]?.count).toBe(1)
    const empty = execute([], { facets: ['mrr', 'plan'] }, schema)
    expect(empty.facets?.['mrr']).toEqual({
      kind: 'histogram',
      min: undefined,
      max: undefined,
      bins: [],
    })
  })

  it('pages after sorting', () => {
    const result = run('sort by mrr', { page: { offset: 1, limit: 2 } })
    expect(ids(result)).toEqual([2, 4])
    expect(result.matched).toBe(5)
  })
})

describe('trees', () => {
  const treeSchema = createSchema({
    columns: [{ id: 'title' }, { id: 'points', type: 'int' }],
    parent: 'parent',
  })
  const issues = [
    { id: 'e1', parent: null, title: 'Epic one', points: 0 },
    { id: 's1', parent: 'e1', title: 'Story one', points: 3 },
    { id: 't1', parent: 's1', title: 'Task alpha', points: 1 },
    { id: 's2', parent: 'e1', title: 'Story two', points: 5 },
    { id: 'e2', parent: null, title: 'Epic two', points: 0 },
  ]

  it('keeps ancestors of matches', () => {
    const parsed = parseQuery('alpha', treeSchema)
    const result = execute(issues, parsed.query, treeSchema)
    expect(result.rows.map((row) => row['id'])).toEqual(['e1', 's1', 't1'])
    expect(result.matched).toBe(1)
  })

  it('flattens with depth, expansion and sorting', () => {
    const nodes = flattenTree(issues, treeSchema, { expanded: () => true })
    expect(nodes.map((node) => [node.key, node.depth, node.hasChildren])).toEqual([
      ['e1', 0, true],
      ['s1', 1, true],
      ['t1', 2, false],
      ['s2', 1, false],
      ['e2', 0, false],
    ])
    const collapsed = flattenTree(issues, treeSchema)
    expect(collapsed.map((node) => node.key)).toEqual(['e1', 's1', 's2', 'e2'])
    const matched = flattenTree(issues, treeSchema, {
      matched: new Set(['t1']),
      expanded: () => true,
      compare: (a, b) => String(b['title']).localeCompare(String(a['title'])),
    })
    expect(matched.map((node) => [node.key, node.matched])).toEqual([
      ['e2', false],
      ['e1', false],
      ['s2', false],
      ['s1', false],
      ['t1', true],
    ])
  })
})

describe('context', () => {
  it('defaults today to the current date', () => {
    expect(createExecutionContext().today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
