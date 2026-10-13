import {
  condition as is,
  createArraySource,
  isEmptyValue,
  type Capabilities,
  type Facet,
  type Filter,
  type GroupSummary,
  type Pagination,
  type QueryRequest,
  type QueryResponse,
  type RowData,
  type Sort,
} from 'tally-core'
import { CONFORMANCE_TODAY, conformanceRows, conformanceSchema } from './fixtures.ts'

export type ConformanceFeature = Exclude<keyof Capabilities, 'mutate' | 'live' | 'pagination'>

export interface ConformanceCase {
  readonly name: string
  readonly request: QueryRequest
  readonly requires?: readonly ConformanceFeature[] | undefined
}

export type ConformanceHandler = (request: QueryRequest) => Promise<QueryResponse>

export interface ConformanceOptions {
  readonly capabilities?: Partial<Capabilities> | undefined
  readonly cases?: readonly ConformanceCase[] | undefined
  readonly tolerance?: number | undefined
}

export interface ConformanceResult {
  readonly name: string
  readonly passed: boolean
  readonly diffs: readonly string[]
}

export interface ConformanceReport {
  readonly passed: boolean
  readonly results: readonly ConformanceResult[]
  readonly failures: readonly ConformanceResult[]
}

const BY_KEY: Sort = { column: 'id', direction: 'asc' }

function sorted(...sort: readonly Sort[]): readonly Sort[] {
  return [...sort, BY_KEY]
}

function where(
  name: string,
  filter: Filter,
  requires: readonly ConformanceFeature[] = ['filter'],
): ConformanceCase {
  return { name, request: { version: 1, filter, sort: sorted() }, requires }
}

function ordered(name: string, ...sort: readonly Sort[]): ConformanceCase {
  return { name, request: { version: 1, sort: sorted(...sort) }, requires: ['sort'] }
}

function grouped(name: string, request: Partial<QueryRequest>): ConformanceCase {
  return {
    name,
    request: { version: 1, sort: sorted(), ...request },
    requires: ['group', 'aggregates'],
  }
}

export const conformanceCases: readonly ConformanceCase[] = [
  { name: 'all rows', request: { version: 1, sort: sorted() } },
  where('text eq ignores case', is('account', 'eq', 'ACME')),
  where('text neq', is('account', 'neq', 'acme')),
  where('text contains', is('account', 'contains', 'O')),
  where('text notContains', is('account', 'notContains', 'o')),
  where('text startsWith', is('account', 'startsWith', 'de')),
  where('text endsWith', is('account', 'endsWith', 'A')),
  where('text in', is('account', 'in', ['acme', 'KILO'])),
  where('text notIn', is('account', 'notIn', ['acme', 'kilo'])),
  where('text empty treats blank as empty', is('email', 'empty')),
  where('text notEmpty', is('email', 'notEmpty')),
  where('person eq', is('owner', 'eq', 'mona')),
  where('number eq', is('mrr', 'eq', 250)),
  where('number neq keeps nulls', is('mrr', 'neq', 250)),
  where('number lt', is('seats', 'lt', 10)),
  where('number lte', is('seats', 'lte', 10)),
  where('number gt', is('score', 'gt', 50)),
  where('number gte', is('score', 'gte', 50)),
  where('number between', is('health', 'between', [20, 60])),
  where('number in', is('seats', 'in', [1, 8, 15])),
  where('number notIn', is('seats', 'notIn', [1, 8, 15])),
  where('number empty', is('mrr', 'empty')),
  where('number notEmpty', is('mrr', 'notEmpty')),
  where('percent lt negative', is('growth', 'lt', 0)),
  where('date eq', is('renewal', 'eq', '2025-06-24')),
  where('date lt', is('renewal', 'lt', '2026-01-01')),
  where('date gte', is('renewal', 'gte', '2026-01-01')),
  where('date between', is('renewal', 'between', ['2025-10-01', '2025-12-31'])),
  where('date empty', is('renewal', 'empty')),
  where(
    'date within last 90 days',
    is('renewal', 'within', { direction: 'last', amount: 90, unit: 'day' }),
  ),
  where(
    'date within next 2 months',
    is('renewal', 'within', { direction: 'next', amount: 2, unit: 'month' }),
  ),
  where(
    'date within this quarter',
    is('renewal', 'within', { direction: 'this', amount: 1, unit: 'quarter' }),
  ),
  where(
    'date within last month shifted',
    is('renewal', 'within', { direction: 'this', amount: 1, unit: 'month', shift: -1 }),
  ),
  where('bool eq true', is('active', 'eq', true)),
  where('bool eq false', is('active', 'eq', false)),
  where('bool neq true keeps nulls', is('active', 'neq', true)),
  where('bool empty', is('active', 'empty')),
  where('enum eq', is('plan', 'eq', 'pro')),
  where('enum in', is('plan', 'in', ['free', 'team'])),
  where('enum notIn', is('plan', 'notIn', ['free', 'team'])),
  where('enum empty', is('plan', 'empty')),
  where('and', { type: 'and', filters: [is('plan', 'eq', 'pro'), is('mrr', 'gt', 500)] }),
  where('or', { type: 'or', filters: [is('plan', 'eq', 'team'), is('seats', 'lt', 5)] }),
  where('not', { type: 'not', filter: is('plan', 'eq', 'team') }),
  where('nested', {
    type: 'and',
    filters: [
      { type: 'or', filters: [is('plan', 'eq', 'pro'), is('plan', 'empty')] },
      {
        type: 'not',
        filter: { type: 'and', filters: [is('active', 'eq', true), is('mrr', 'lt', 300)] },
      },
    ],
  }),
  where('search', { type: 'search', text: 'lum' }, ['search']),
  where(
    'search with condition',
    {
      type: 'and',
      filters: [{ type: 'search', text: 'example.com' }, is('plan', 'eq', 'free')],
    },
    ['search', 'filter'],
  ),
  ordered('sort text asc', { column: 'account', direction: 'asc' }),
  ordered('sort text desc', { column: 'account', direction: 'desc' }),
  ordered('sort number asc nulls last', { column: 'mrr', direction: 'asc' }),
  ordered('sort number desc nulls last', { column: 'mrr', direction: 'desc' }),
  ordered('sort date asc', { column: 'renewal', direction: 'asc' }),
  ordered('sort date desc', { column: 'renewal', direction: 'desc' }),
  ordered('sort bool asc', { column: 'active', direction: 'asc' }),
  ordered('sort enum by option order', { column: 'plan', direction: 'asc' }),
  ordered('sort enum desc', { column: 'plan', direction: 'desc' }),
  ordered('sort multi', { column: 'plan', direction: 'asc' }, { column: 'mrr', direction: 'desc' }),
  grouped('group enum', { group: { column: 'plan' } }),
  grouped('group enum with aggregates', {
    group: { column: 'plan' },
    aggregates: [
      { column: 'mrr', fn: 'sum' },
      { column: 'mrr', fn: 'avg' },
      { column: 'seats', fn: 'max' },
      { column: 'account', fn: 'distinct' },
    ],
  }),
  grouped('group bool', { group: { column: 'active' } }),
  grouped('group person', { group: { column: 'owner' } }),
  grouped('group date month', { group: { column: 'renewal', granularity: 'month' } }),
  grouped('group date day', { group: { column: 'renewal', granularity: 'day' } }),
  grouped('group date week', { group: { column: 'renewal', granularity: 'week' } }),
  grouped('group date quarter', { group: { column: 'renewal', granularity: 'quarter' } }),
  grouped('group date year', { group: { column: 'renewal', granularity: 'year' } }),
  grouped('group sorted by group column', {
    group: { column: 'plan' },
    sort: sorted({ column: 'plan', direction: 'desc' }),
  }),
  grouped('group with filter', { group: { column: 'plan' }, filter: is('mrr', 'gte', 500) }),
  {
    name: 'aggregates number',
    request: {
      version: 1,
      sort: sorted(),
      aggregates: [
        { column: 'mrr', fn: 'sum' },
        { column: 'mrr', fn: 'avg' },
        { column: 'mrr', fn: 'min' },
        { column: 'mrr', fn: 'max' },
        { column: 'mrr', fn: 'count' },
        { column: 'mrr', fn: 'distinct' },
        { column: 'score', fn: 'avg' },
      ],
    },
    requires: ['aggregates'],
  },
  {
    name: 'aggregates date and text',
    request: {
      version: 1,
      sort: sorted(),
      aggregates: [
        { column: 'renewal', fn: 'min' },
        { column: 'renewal', fn: 'max' },
        { column: 'renewal', fn: 'count' },
        { column: 'account', fn: 'count' },
        { column: 'account', fn: 'distinct' },
        { column: 'email', fn: 'count' },
      ],
    },
    requires: ['aggregates'],
  },
  {
    name: 'aggregates over filtered rows',
    request: {
      version: 1,
      sort: sorted(),
      filter: is('plan', 'eq', 'team'),
      aggregates: [
        { column: 'mrr', fn: 'sum' },
        { column: 'seats', fn: 'avg' },
      ],
    },
    requires: ['filter', 'aggregates'],
  },
  {
    name: 'facets terms',
    request: { version: 1, sort: sorted(), facets: ['plan', 'active', 'owner'] },
    requires: ['facets'],
  },
  {
    name: 'facets histogram',
    request: { version: 1, sort: sorted(), facets: ['mrr', 'score', 'renewal'] },
    requires: ['facets'],
  },
  {
    name: 'facets over filtered rows',
    request: {
      version: 1,
      sort: sorted(),
      filter: is('active', 'eq', true),
      facets: ['plan', 'mrr'],
    },
    requires: ['filter', 'facets'],
  },
]

export const conformancePageCases: readonly ConformanceCase[] = [
  { name: 'page first', request: { version: 1, sort: sorted(), page: { offset: 0, limit: 7 } } },
  { name: 'page middle', request: { version: 1, sort: sorted(), page: { offset: 14, limit: 7 } } },
  {
    name: 'page last partial',
    request: { version: 1, sort: sorted(), page: { offset: 56, limit: 7 } },
  },
  {
    name: 'page beyond end',
    request: { version: 1, sort: sorted(), page: { offset: 70, limit: 7 } },
  },
  {
    name: 'page sorted and filtered',
    request: {
      version: 1,
      sort: sorted({ column: 'mrr', direction: 'desc' }),
      filter: is('plan', 'neq', 'free'),
      page: { offset: 5, limit: 10 },
    },
    requires: ['filter', 'sort'],
  },
  {
    name: 'page grouped',
    request: {
      version: 1,
      sort: sorted(),
      group: { column: 'plan' },
      page: { offset: 10, limit: 10 },
    },
    requires: ['group'],
  },
]

const FULL: Capabilities = {
  filter: true,
  sort: true,
  group: true,
  search: true,
  aggregates: true,
  facets: true,
  pagination: 'offset',
  mutate: false,
  live: false,
}

function close(a: unknown, b: unknown, tolerance: number): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b))
  }
  return Object.is(a, b)
}

function show(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

function compareValue(
  path: string,
  expected: unknown,
  actual: unknown,
  tolerance: number,
): string[] {
  return close(expected, actual, tolerance)
    ? []
    : [`${path}: expected ${show(expected)}, got ${show(actual)}`]
}

function compareRecord(
  path: string,
  expected: Readonly<Record<string, unknown>>,
  actual: Readonly<Record<string, unknown>> | undefined,
  tolerance: number,
): string[] {
  if (actual === undefined) return [`${path}: missing`]
  const diffs: string[] = []
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    diffs.push(...compareValue(`${path}.${key}`, expected[key], actual[key], tolerance))
  }
  return diffs
}

function compareRows(
  expected: readonly RowData[],
  actual: readonly RowData[],
  tolerance: number,
): string[] {
  if (expected.length !== actual.length) {
    return [
      `rows: expected ${expected.length} rows, got ${actual.length}`,
      `rows: expected keys ${show(expected.map((row) => row['id']))}, got ${show(actual.map((row) => row['id']))}`,
    ]
  }
  const diffs: string[] = []
  expected.forEach((row, index) => {
    const other = actual[index]
    if (other === undefined) return
    if (row['id'] !== other['id']) {
      diffs.push(`rows[${index}]: expected key ${show(row['id'])}, got ${show(other['id'])}`)
      return
    }
    for (const column of conformanceSchema.columns) {
      diffs.push(
        ...compareValue(`rows[${index}].${column.id}`, row[column.id], other[column.id], tolerance),
      )
    }
  })
  return diffs
}

function compareGroups(
  expected: readonly GroupSummary[] | undefined,
  actual: readonly GroupSummary[] | undefined,
  tolerance: number,
): string[] {
  if (expected === undefined) return actual === undefined ? [] : ['groups: unexpected']
  if (actual === undefined) return ['groups: missing']
  if (expected.length !== actual.length) {
    return [`groups: expected ${expected.length} groups, got ${actual.length}`]
  }
  return expected.flatMap((group, index) => {
    const other = actual[index]
    if (other === undefined) return []
    const path = `groups[${index}]`
    if (group.key !== other.key) {
      return [`${path}.key: expected ${show(group.key)}, got ${show(other.key)}`]
    }
    return [
      ...compareValue(`${path}.value`, group.value, other.value, tolerance),
      ...compareValue(`${path}.count`, group.count, other.count, tolerance),
      ...compareRecord(`${path}.aggregates`, group.aggregates, other.aggregates, tolerance),
    ]
  })
}

function termKey(value: unknown): string {
  return JSON.stringify(value)
}

function compareFacet(
  path: string,
  expected: Facet,
  actual: Facet | undefined,
  tolerance: number,
): string[] {
  if (actual === undefined) return [`${path}: missing`]
  if (expected.kind !== actual.kind) {
    return [`${path}.kind: expected ${expected.kind}, got ${actual.kind}`]
  }
  if (expected.kind === 'terms' && actual.kind === 'terms') {
    const diffs = compareValue(`${path}.distinct`, expected.distinct, actual.distinct, tolerance)
    const counts = new Map(actual.terms.map((term) => [termKey(term.value), term.count]))
    if (expected.terms.length !== actual.terms.length) {
      diffs.push(
        `${path}.terms: expected ${expected.terms.length} terms, got ${actual.terms.length}`,
      )
    }
    for (const term of expected.terms) {
      diffs.push(
        ...compareValue(
          `${path}.terms[${termKey(term.value)}]`,
          term.count,
          counts.get(termKey(term.value)),
          tolerance,
        ),
      )
    }
    return diffs
  }
  if (expected.kind === 'histogram' && actual.kind === 'histogram') {
    const diffs = [
      ...compareValue(`${path}.min`, expected.min, actual.min, tolerance),
      ...compareValue(`${path}.max`, expected.max, actual.max, tolerance),
    ]
    if (expected.bins.length !== actual.bins.length) {
      return [
        ...diffs,
        `${path}.bins: expected ${expected.bins.length} bins, got ${actual.bins.length}`,
      ]
    }
    expected.bins.forEach((bin, index) => {
      const other = actual.bins[index]
      if (other === undefined) return
      diffs.push(
        ...compareValue(`${path}.bins[${index}].start`, bin.start, other.start, tolerance),
        ...compareValue(`${path}.bins[${index}].end`, bin.end, other.end, tolerance),
        ...compareValue(`${path}.bins[${index}].count`, bin.count, other.count, tolerance),
      )
    })
    return diffs
  }
  return []
}

export function diffResponses(
  expected: QueryResponse,
  actual: QueryResponse,
  tolerance = 1e-6,
): readonly string[] {
  const diffs = [
    ...compareRows(expected.rows, actual.rows, tolerance),
    ...compareValue('total', expected.total, actual.total, tolerance),
    ...compareValue('matched', expected.matched, actual.matched, tolerance),
    ...compareGroups(expected.groups, actual.groups, tolerance),
  ]
  if (expected.aggregates !== undefined) {
    diffs.push(...compareRecord('aggregates', expected.aggregates, actual.aggregates, tolerance))
  }
  if (expected.facets !== undefined) {
    if (actual.facets === undefined) diffs.push('facets: missing')
    else {
      for (const [id, facet] of Object.entries(expected.facets)) {
        diffs.push(...compareFacet(`facets.${id}`, facet, actual.facets[id], tolerance))
      }
    }
  }
  return diffs
}

function supports(entry: ConformanceCase, capabilities: Capabilities): boolean {
  return (entry.requires ?? []).every((feature) => capabilities[feature])
}

async function walk(
  handler: ConformanceHandler,
  request: QueryRequest,
  limit: number,
  cursor?: string,
  rows: readonly RowData[] = [],
  depth = 0,
): Promise<QueryResponse> {
  const page: QueryRequest['page'] = cursor === undefined ? { limit } : { cursor, limit }
  const response = await handler({ ...request, page })
  const collected = [...rows, ...response.rows]
  if (response.cursor === undefined || response.rows.length === 0 || depth >= 100) {
    return { ...response, rows: collected }
  }
  return walk(handler, request, limit, response.cursor, collected, depth + 1)
}

export async function runConformance(
  handler: ConformanceHandler,
  options: ConformanceOptions = {},
): Promise<ConformanceReport> {
  const capabilities: Capabilities = { ...FULL, ...options.capabilities }
  const tolerance = options.tolerance ?? 1e-6
  const pagination: Pagination = capabilities.pagination
  const reference = createArraySource(conformanceRows, conformanceSchema, {
    today: CONFORMANCE_TODAY,
    pagination: pagination === 'cursor' ? 'none' : pagination,
  })
  const run = async (
    entry: ConformanceCase,
    actual: Promise<QueryResponse>,
  ): Promise<ConformanceResult> => {
    const expected = await reference.query(entry.request)
    let diffs: readonly string[]
    try {
      diffs = diffResponses(expected, await actual, tolerance)
    } catch (error) {
      diffs = [`threw: ${error instanceof Error ? error.message : String(error)}`]
    }
    return { name: entry.name, passed: diffs.length === 0, diffs }
  }
  const supported = (entries: readonly ConformanceCase[]): readonly ConformanceCase[] =>
    entries.filter((candidate) => supports(candidate, capabilities))
  const cases = supported(options.cases ?? conformanceCases)
  const paged =
    options.cases === undefined && pagination === 'offset' ? supported(conformancePageCases) : []
  const walked =
    options.cases === undefined && pagination === 'cursor'
      ? cases.slice(0, 12).map((entry) => ({ ...entry, name: `${entry.name} via cursor` }))
      : []
  const results = await Promise.all([
    ...[...cases, ...paged].map((entry) => run(entry, handler(entry.request))),
    ...walked.map((entry) => run(entry, walk(handler, entry.request, 17))),
  ])
  const failures = results.filter((result) => !result.passed)
  return { passed: failures.length === 0, results, failures }
}
