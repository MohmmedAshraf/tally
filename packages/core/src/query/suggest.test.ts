import { describe, expect, it } from 'vitest'
import { createSchema } from '../schema/schema.ts'
import { suggest, tokenAt } from './suggest.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'owner', label: 'Account Owner', type: 'person' },
    {
      id: 'status',
      type: 'enum',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'past_due', label: 'Past due' },
      ],
    },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
    { id: 'trial', type: 'bool' },
    { id: 'notes', sortable: false },
  ],
})

function inserts(text: string, cursor = text.length, options = {}): string[] {
  return suggest(text, cursor, schema, options).map((item) => item.insert)
}

describe('suggest', () => {
  it('offers examples on an empty query and columns otherwise', () => {
    expect(inserts('', 0, { examples: ['status is active', 'mrr > 2k'] })).toEqual([
      'status is active',
      'mrr > 2k',
    ])
    expect(inserts('')).toEqual([
      'account ',
      'owner ',
      'status ',
      'mrr ',
      'renewal ',
      'trial ',
      'notes ',
    ])
    expect(inserts('st')).toEqual(['status '])
    expect(inserts('own')).toEqual(['owner '])
    expect(inserts('account o')).toEqual(['owner '])
  })

  it('offers operators after a column', () => {
    expect(inserts('status ')).toEqual(['status is ', 'status is not ', 'status is empty '])
    expect(inserts('status is n')).toEqual(['status is not '])
    expect(inserts('mrr')).toEqual([
      'mrr > ',
      'mrr < ',
      'mrr >= ',
      'mrr <= ',
      'mrr between ',
      'mrr is ',
    ])
    expect(inserts('renewal ')).toContain('renewal last 30 days ')
    expect(inserts('account ')).toEqual([
      'account contains ',
      'account is ',
      'account starts with ',
      'account is empty ',
    ])
    expect(inserts('trial ')).toEqual(['trial is yes ', 'trial is no '])
  })

  it('offers values after an operator', () => {
    expect(inserts('status is ')).toEqual(['status is Active', 'status is Past due'])
    expect(inserts('status is pa')).toEqual(['status is Past due'])
    expect(inserts('status is not act')).toEqual(['status is not Active'])
    expect(inserts('trial is ')).toEqual(['trial is yes', 'trial is no'])
    expect(inserts('renewal after t')).toEqual([
      'renewal after today',
      'renewal after this week',
      'renewal after this month',
      'renewal after this quarter',
    ])
    expect(inserts('account contains ')).toEqual([])
  })

  it('uses facets for numeric quantiles', () => {
    const facets = {
      mrr: { kind: 'histogram', min: 0, max: 10_000, bins: [] },
    } as const
    const items = suggest('mrr > ', 6, schema, { facets })
    expect(items.map((item) => [item.insert, item.detail])).toEqual([
      ['mrr > 2500', '25th percentile'],
      ['mrr > 5000', '50th percentile'],
      ['mrr > 7500', '75th percentile'],
    ])
    expect(inserts('mrr > ')).toEqual([])
    expect(inserts('mrr > 5')).toEqual([])
  })

  it('handles directives', () => {
    expect(inserts('sort by ')).toEqual([
      'sort by account ',
      'sort by owner ',
      'sort by status ',
      'sort by mrr ',
      'sort by renewal ',
      'sort by trial ',
    ])
    expect(inserts('sort by m')).toEqual(['sort by mrr '])
    expect(inserts('sort by mrr')).toEqual(['sort by mrr asc', 'sort by mrr desc'])
    expect(inserts('group by ')).toEqual([
      'group by owner ',
      'group by status ',
      'group by renewal ',
      'group by trial ',
    ])
    expect(inserts('sor')).toEqual(['sort by '])
    expect(inserts('gro')).toEqual(['group by '])
  })

  it('falls back to search and scopes to the current clause', () => {
    expect(inserts('acme corp')).toEqual(['acme corp'])
    expect(inserts('zzz')).toEqual(['zzz'])
    const items = suggest('status is active and mr', 23, schema)
    expect(items.map((item) => item.insert)).toEqual(['mrr '])
    expect(items[0]?.replace).toEqual({ start: 21, end: 23 })
    expect(inserts('(status is active or mrr > 5) , st')).toEqual(['status '])
    expect(inserts('status is active, ')).toHaveLength(7)
  })

  it('respects the limit and finds tokens at a cursor', () => {
    expect(inserts('', 0, { limit: 2 })).toHaveLength(2)
    expect(tokenAt('status is active', 12, schema)?.image).toBe('active')
    expect(tokenAt('status is active', 7, schema)?.image).toBe('is')
    expect(tokenAt('', 0, schema)).toBeUndefined()
  })
})
