import { describe, expect, it } from 'vitest'
import { inferFromCsv, inferFromRows, parseQueryText, validateRequest } from './tools.ts'

const columns = [{ id: 'name' }, { id: 'mrr', type: 'currency' }]

describe('parseQueryText', () => {
  it('returns the query and its canonical form', () => {
    const result = parseQueryText('mrr > 2k', columns)
    expect(result.ok).toBe(true)
    expect(result.query).toBeDefined()
    expect(result.printed).toBe('mrr > 2000')
    expect(result.errors).toEqual([])
  })

  it('returns errors with offsets and no query', () => {
    const result = parseQueryText('ghost is 1', columns)
    expect(result.ok).toBe(false)
    expect(result.query).toBeUndefined()
    expect(result.printed).toBeUndefined()
    expect(result.errors).toEqual([{ message: 'Unexpected "is"', offset: 6 }])
  })
})

describe('validateRequest', () => {
  it('accepts a valid query request', () => {
    expect(validateRequest('query', { version: 1, sort: [] }, columns)).toEqual({
      valid: true,
      issues: [],
    })
  })

  it('validates mutation requests against the key', () => {
    expect(validateRequest('mutation', { version: 1, mutations: [] }, columns, 'name')).toEqual({
      valid: true,
      issues: [],
    })
  })

  it('reports wire shape errors', () => {
    const result = validateRequest('mutation', { version: 2 }, columns)
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('reports column errors with their details', () => {
    const result = validateRequest('query', { version: 1 }, [{ id: '' }])
    expect(result.valid).toBe(false)
    expect(result.issues[0]).toContain('id')
  })

  it('falls back to the error message when there are no details', () => {
    const result = validateRequest('query', { version: 1 }, [{ id: 'a' }, { id: 'a' }])
    expect(result).toEqual({ valid: false, issues: ['Duplicate column id "a"'] })
  })
})

describe('inferFromRows', () => {
  it('uses the given key and samples scalar values', () => {
    const result = inferFromRows(
      [
        { sku: 'a', active: true, count: 10n, note: null },
        { sku: 'b', active: false, count: 20n, note: undefined },
      ],
      'sku',
    )
    expect(result.key).toBe('sku')
    expect(result.issues).toEqual([])
    expect(result.columns.map((column) => column.id)).toEqual(['sku', 'active', 'count', 'note'])
    expect(result.columns.find((column) => column.id === 'active')?.type).toBe('bool')
  })

  it('leaves the key undefined without an id field', () => {
    expect(inferFromRows([{ name: 'Acme' }]).key).toBeUndefined()
  })
})

describe('inferFromCsv', () => {
  it('honors an explicit key', () => {
    const result = inferFromCsv('sku,name\na,Acme\nb,Globex\n', 'sku')
    expect(result.key).toBe('sku')
    expect(result.columns.map((column) => column.id)).toEqual(['sku', 'name'])
  })
})
