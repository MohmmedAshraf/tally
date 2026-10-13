import { describe, expect, it } from 'vitest'
import { createSchema } from '../schema/schema.ts'
import { toCsv, toTsv } from './csv.ts'

const schema = createSchema({
  columns: [
    { id: 'name', label: 'Name' },
    { id: 'plan', type: 'enum', options: [{ value: 'pro', label: 'Pro' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
    { id: 'meta' },
  ],
})

const rows = [
  { id: 1, name: 'North, Labs', plan: 'pro', mrr: 1200.5, renewal: '2026-10-13', meta: { a: 1 } },
  { id: 2, name: '=SUM(A1)', plan: null, mrr: null, renewal: null, meta: true },
]

describe('toCsv', () => {
  it('writes raw values with ids by default', () => {
    expect(toCsv(rows, schema)).toBe(
      'name,plan,mrr,renewal,meta\n"North, Labs",pro,1200.5,2026-10-13,"{""a"":1}"\n"\'=SUM(A1)",,,,true',
    )
  })

  it('writes formatted values with labels', () => {
    expect(
      toCsv(rows, schema, {
        formatted: true,
        header: 'label',
        columns: schema.columns.slice(0, 4),
      }),
    ).toBe('Name,plan,MRR,renewal\n"North, Labs",Pro,"$1,200.50","Oct 13, 2026"\n"\'=SUM(A1)",,,')
  })

  it('writes tab separated text without a header for the clipboard', () => {
    expect(toTsv(rows.slice(0, 1), schema, { columns: schema.columns.slice(1, 3) })).toBe(
      'Pro\t$1,200.50',
    )
    expect(toCsv([], schema, { header: 'none' })).toBe('')
  })
})
