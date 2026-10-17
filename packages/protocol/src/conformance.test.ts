import { createArraySource, type QueryResponse } from 'tally-core'
import { describe, expect, it } from 'vitest'
import {
  conformanceCases,
  conformancePageCases,
  diffResponses,
  runConformance,
} from './conformance.ts'
import { CONFORMANCE_TODAY, conformanceRows, conformanceSchema } from './fixtures.ts'

describe('runConformance', () => {
  it('passes the array source with offset pagination', async () => {
    const source = createArraySource(conformanceRows, conformanceSchema, {
      today: CONFORMANCE_TODAY,
      pagination: 'offset',
    })
    const report = await runConformance((request) => source.query(request))
    expect(report.failures).toEqual([])
    expect(report.results).toHaveLength(conformanceCases.length + conformancePageCases.length)
  })

  it('walks cursor pagination', async () => {
    const source = createArraySource(conformanceRows, conformanceSchema, {
      today: CONFORMANCE_TODAY,
      pagination: 'cursor',
    })
    const report = await runConformance((request) => source.query(request), {
      capabilities: { pagination: 'cursor' },
    })
    expect(report.failures).toEqual([])
    expect(report.results.filter((result) => result.name.endsWith('via cursor'))).toHaveLength(12)
  })

  it('skips cases the adapter does not support', async () => {
    const source = createArraySource(conformanceRows, conformanceSchema, {
      today: CONFORMANCE_TODAY,
    })
    const report = await runConformance((request) => source.query(request), {
      capabilities: { facets: false, group: false, search: false, pagination: 'none' },
    })
    expect(report.passed).toBe(true)
    expect(report.results.some((result) => result.name.startsWith('facets'))).toBe(false)
    expect(report.results.some((result) => result.name.startsWith('group'))).toBe(false)
    expect(report.results.some((result) => result.name.startsWith('page'))).toBe(false)
  })

  it('explains what a wrong adapter got wrong', async () => {
    const source = createArraySource(conformanceRows, conformanceSchema, {
      today: CONFORMANCE_TODAY,
    })
    const report = await runConformance(
      async (request): Promise<QueryResponse> => {
        if (request.filter?.type === 'search') throw new Error('no search')
        const response = await source.query({ ...request, sort: [] })
        return { ...response, total: 1, aggregates: undefined }
      },
      { capabilities: { pagination: 'none' } },
    )
    expect(report.passed).toBe(false)
    const search = report.failures.find((result) => result.name === 'search')
    expect(search?.diffs).toEqual(['threw: no search'])
    const sorted = report.failures.find((result) => result.name === 'sort number asc nulls last')
    expect(sorted?.diffs[0]).toMatch(/^rows\[\d+\]: expected key/)
    expect(sorted?.diffs).toContain('total: expected 60, got 1')
    const aggregates = report.failures.find((result) => result.name === 'aggregates number')
    expect(aggregates?.diffs).toContain('aggregates: missing')
  })
})

describe('runConformance options', () => {
  it('runs only the given cases with a custom tolerance', async () => {
    const report = await runConformance(
      () =>
        Promise.resolve({
          rows: [],
          total: 0,
          matched: 0,
          aggregates: { 'mrr:sum': 34000 },
        }),
      {
        cases: [
          {
            name: 'empty',
            request: { version: 1, sort: [], aggregates: [{ column: 'mrr', fn: 'sum' }] },
          },
        ],
        tolerance: 0.1,
      },
    )
    expect(report.results.map((result) => result.name)).toEqual(['empty'])
    expect(report.failures[0]?.diffs).toEqual([
      'rows: expected 60 rows, got 0',
      expect.stringContaining('rows: expected keys'),
      'total: expected 60, got 0',
      'matched: expected 60, got 0',
    ])
  })

  it('reports thrown values that are not errors', async () => {
    const report = await runConformance(() => Promise.reject('down'), {
      cases: [{ name: 'all', request: { version: 1, sort: [] } }],
    })
    expect(report.failures[0]?.diffs).toEqual(['threw: down'])
  })
})

describe('diffResponses', () => {
  const base: QueryResponse = { rows: [{ id: 'a', mrr: 10 }], total: 1, matched: 1 }

  it('compares cell values within tolerance', () => {
    expect(diffResponses(base, { ...base, rows: [{ id: 'a', mrr: 10.0000001 }] })).toEqual([])
    expect(diffResponses(base, { ...base, rows: [{ id: 'a', mrr: null }] })).toEqual([
      'rows[0].mrr: expected 10, got null',
    ])
    expect(
      diffResponses({ ...base, rows: [{ id: 'a' }] }, { ...base, rows: [{ id: 'a', mrr: null }] }),
    ).toEqual([])
  })

  it('compares groups', () => {
    const group = { key: 'pro', value: 'pro', count: 2, aggregates: { mrr: 5 } }
    expect(diffResponses(base, { ...base, groups: [group] })).toEqual(['groups: unexpected'])
    expect(diffResponses({ ...base, groups: [group] }, base)).toEqual(['groups: missing'])
    expect(diffResponses({ ...base, groups: [group] }, { ...base, groups: [] })).toEqual([
      'groups: expected 1 groups, got 0',
    ])
    expect(
      diffResponses({ ...base, groups: [group] }, { ...base, groups: [{ ...group, key: 'team' }] }),
    ).toEqual(['groups[0].key: expected "pro", got "team"'])
    expect(
      diffResponses(
        { ...base, groups: [group] },
        { ...base, groups: [{ ...group, count: 3, aggregates: { mrr: 6, seats: 1 } }] },
      ),
    ).toEqual([
      'groups[0].count: expected 2, got 3',
      'groups[0].aggregates.mrr: expected 5, got 6',
      'groups[0].aggregates.seats: expected undefined, got 1',
    ])
  })

  it('compares facets', () => {
    const terms = { kind: 'terms', distinct: 2, terms: [{ value: 'pro', count: 3 }] } as const
    const histogram = {
      kind: 'histogram',
      min: 0,
      max: 10,
      bins: [{ start: 0, end: 10, count: 4 }],
    } as const
    const expected: QueryResponse = { ...base, facets: { plan: terms, mrr: histogram } }
    expect(diffResponses(expected, base)).toEqual(['facets: missing'])
    expect(diffResponses(expected, { ...base, facets: { plan: histogram } })).toEqual([
      'facets.plan.kind: expected terms, got histogram',
      'facets.mrr: missing',
    ])
    expect(
      diffResponses(expected, {
        ...base,
        facets: {
          plan: { kind: 'terms', distinct: 3, terms: [] },
          mrr: { ...histogram, max: 11, bins: [] },
        },
      }),
    ).toEqual([
      'facets.plan.distinct: expected 2, got 3',
      'facets.plan.terms: expected 1 terms, got 0',
      'facets.plan.terms["pro"]: expected 3, got undefined',
      'facets.mrr.max: expected 10, got 11',
      'facets.mrr.bins: expected 1 bins, got 0',
    ])
    expect(
      diffResponses(expected, {
        ...base,
        facets: { plan: terms, mrr: { ...histogram, bins: [{ start: 1, end: 10, count: 5 }] } },
      }),
    ).toEqual([
      'facets.mrr.bins[0].start: expected 0, got 1',
      'facets.mrr.bins[0].count: expected 4, got 5',
    ])
  })
})
