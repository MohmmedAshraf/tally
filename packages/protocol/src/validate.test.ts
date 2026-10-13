import { TallyError, createMutation, createSchema } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { conformanceSchema } from './fixtures.ts'
import {
  mutationIssues,
  parseQueryRequest,
  queryIssues,
  validateMutationRequest,
  validateQueryRequest,
} from './validate.ts'

function details(run: () => unknown): readonly string[] {
  try {
    run()
  } catch (error) {
    if (error instanceof TallyError) return error.details
    throw error
  }
  throw new Error('expected a TallyError')
}

describe('parseQueryRequest', () => {
  it('accepts a full request and strips nothing', () => {
    const request = parseQueryRequest({
      version: 1,
      filter: {
        type: 'and',
        filters: [
          { type: 'condition', column: 'plan', op: 'eq', value: 'pro' },
          { type: 'not', filter: { type: 'search', text: 'x' } },
        ],
      },
      sort: [{ column: 'mrr', direction: 'desc' }],
      group: { column: 'renewal', granularity: 'quarter' },
      page: { cursor: 'abc', limit: 20 },
      aggregates: [{ column: 'mrr', fn: 'sum' }],
      facets: ['plan'],
    })
    expect(request.page).toEqual({ cursor: 'abc', limit: 20 })
  })

  it('rejects unknown keys, bad versions and bad pages', () => {
    expect(details(() => parseQueryRequest({ version: 2, sort: [] }))).toEqual([
      'version: Invalid input: expected 1',
    ])
    expect(details(() => parseQueryRequest({ version: 1, sort: [], extra: true }))).toEqual([
      ': Unrecognized key: "extra"',
    ])
    expect(details(() => parseQueryRequest({ version: 1, sort: [], page: { limit: 0 } }))).toEqual(
      expect.arrayContaining([expect.stringContaining('limit')]),
    )
  })
})

describe('queryIssues', () => {
  it('reports every semantic problem with a path', () => {
    const issues = queryIssues(
      {
        version: 1,
        filter: {
          type: 'or',
          filters: [
            { type: 'condition', column: 'nope', op: 'eq', value: 1 },
            { type: 'condition', column: 'mrr', op: 'contains', value: 'x' },
            { type: 'condition', column: 'mrr', op: 'empty', value: 1 },
            { type: 'condition', column: 'mrr', op: 'between', value: [1] },
            { type: 'condition', column: 'plan', op: 'in', value: [] },
            { type: 'condition', column: 'renewal', op: 'within', value: { direction: 'ago' } },
            { type: 'condition', column: 'renewal', op: 'gt', value: 'yesterday' },
            { type: 'condition', column: 'account', op: 'eq', value: { nested: true } },
          ],
        },
        sort: [{ column: 'missing', direction: 'asc' }],
        group: { column: 'mrr', granularity: 'day' },
        aggregates: [{ column: 'account', fn: 'sum' }],
        facets: ['email'],
      },
      conformanceSchema,
    )
    expect(issues).toEqual([
      'filter.filters.0.column: unknown column "nope"',
      'filter.filters.1.op: operator "contains" is not supported by type "currency"',
      'filter.filters.2.value: operator "empty" takes no value',
      'filter.filters.3.value: expected two number values for "mrr"',
      'filter.filters.4.value: expected a list of enum values for "plan"',
      'filter.filters.5.value: expected a relative range for "renewal"',
      'filter.filters.6.value: expected a date value for "renewal"',
      'filter.filters.7.value: expected a text value for "account"',
      'sort.0.column: unknown column "missing"',
      'group.column: column "mrr" is not groupable',
      'group.granularity: only date columns accept a granularity',
      'aggregates.0.fn: aggregate "sum" is not supported by "account"',
      'facets.0: column "email" has no facet',
    ])
  })

  it('honors column level sortable, filterable and groupable flags', () => {
    const schema = createSchema({
      columns: [
        { id: 'a', sortable: false, filterable: false },
        { id: 'b', type: 'number', groupable: true },
      ],
    })
    expect(
      queryIssues(
        {
          version: 1,
          filter: { type: 'condition', column: 'a', op: 'eq', value: 'x' },
          sort: [{ column: 'a', direction: 'asc' }],
          group: { column: 'b' },
        },
        schema,
      ),
    ).toEqual([
      'filter.column: column "a" is not filterable',
      'sort.0.column: column "a" is not sortable',
    ])
  })

  it('validateQueryRequest throws invalid_query with the issues', () => {
    expect(() =>
      validateQueryRequest(
        { version: 1, sort: [{ column: 'x', direction: 'asc' }] },
        conformanceSchema,
      ),
    ).toThrow(TallyError)
    expect(validateQueryRequest({ version: 1, sort: [] }, conformanceSchema)).toEqual({
      version: 1,
      sort: [],
    })
  })
})

describe('mutationIssues', () => {
  it('checks columns, editability, value kinds and row keys', () => {
    const schema = createSchema({
      columns: [
        { id: 'name', editable: false },
        { id: 'mrr', type: 'currency' },
      ],
    })
    const mutation = createMutation({
      label: 'Edit',
      changes: [
        { key: 1, column: 'name', from: 'a', to: 'b' },
        { key: 1, column: 'mrr', from: 1, to: 'lots' },
        { key: 1, column: 'ghost', from: 1, to: 2 },
        { key: 1, column: 'mrr', from: 1, to: null },
      ],
      inserted: [{ row: { name: 'no key' } }],
      deleted: [{ row: { id: 3 }, index: 0 }],
    })
    expect(mutationIssues({ version: 1, mutations: [mutation] }, schema)).toEqual([
      'mutations.0.changes.0.column: column "name" is not editable',
      'mutations.0.changes.1.to: expected a number value',
      'mutations.0.changes.2.column: unknown column "ghost"',
      'mutations.0.inserted.0.row: Row key must be a string or a number',
    ])
    expect(() => validateMutationRequest({ version: 1, mutations: [mutation] }, schema)).toThrow(
      TallyError,
    )
    expect(validateMutationRequest({ version: 1, mutations: [] }, schema)).toEqual({
      version: 1,
      mutations: [],
    })
  })
})
