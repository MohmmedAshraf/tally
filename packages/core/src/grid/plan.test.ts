import { describe, expect, it } from 'vitest'
import { and, condition, flag, search } from '../query/ast.ts'
import { createSchema } from '../schema/schema.ts'
import { arrayCapabilities } from '../source/array-source.ts'
import type { Capabilities } from '../source/data-source.ts'
import { defaultView } from '../view/view.ts'
import { footerAggregates, planQuery } from './plan.ts'

const schema = createSchema({
  columns: [
    { id: 'name' },
    { id: 'plan', type: 'enum', options: [{ value: 'pro' }] },
    { id: 'mrr', type: 'currency', aggregate: 'sum' },
    { id: 'notes', filterable: false },
    { id: 'renewal', type: 'date' },
  ],
})

const view = {
  ...defaultView(schema),
  filter: and(condition('plan', 'eq', 'pro'), search('acme')),
  sort: [{ column: 'mrr', direction: 'desc' as const }],
  group: { column: 'plan' },
}

const remoteOnly: Capabilities = {
  filter: true,
  sort: true,
  group: false,
  search: false,
  aggregates: false,
  facets: false,
  pagination: 'offset',
  mutate: false,
  live: false,
}

describe('planQuery', () => {
  it('sends everything to a fully capable source', () => {
    const plan = planQuery(view, schema, arrayCapabilities, { offset: 0, limit: 10 })
    expect(plan.local).toBeUndefined()
    expect(plan.request).toEqual({
      version: 1,
      filter: view.filter,
      sort: view.sort,
      group: view.group,
      aggregates: [{ column: 'mrr', fn: 'sum' }],
      facets: ['plan', 'mrr', 'renewal'],
    })
  })

  it('keeps what the source cannot do for the client executor', () => {
    const plan = planQuery(view, schema, remoteOnly, { offset: 20, limit: 10 })
    expect(plan.request).toEqual({
      version: 1,
      sort: view.sort,
      page: { offset: 20, limit: 10 },
    })
    expect(plan.local).toEqual({
      filter: view.filter,
      group: view.group,
      aggregates: [{ column: 'mrr', fn: 'sum' }],
      facets: ['plan', 'mrr', 'renewal'],
    })
  })

  it('always evaluates flags on the client', () => {
    const plan = planQuery({ ...view, filter: flag('changed') }, schema, arrayCapabilities)
    expect(plan.request.filter).toBeUndefined()
    expect(plan.local?.filter).toEqual(flag('changed'))
  })

  it('requests both ends of a date range for date footers', () => {
    const footer = { ...view, footer: { mrr: 'sum' as const, renewal: 'min' as const } }
    expect(footerAggregates(footer, schema)).toEqual([
      { column: 'mrr', fn: 'sum' },
      { column: 'renewal', fn: 'min' },
      { column: 'renewal', fn: 'max' },
    ])
  })
})
