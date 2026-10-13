import { createArraySource, type QueryResponse } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { conformanceCases, conformancePageCases, runConformance } from './conformance.ts'
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
