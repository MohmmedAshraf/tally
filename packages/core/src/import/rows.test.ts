import { describe, expect, it } from 'vitest'
import { TallyError } from '../errors.ts'
import { createSchema } from '../schema/schema.ts'
import { importRows } from './rows.ts'

describe('importRows', () => {
  const schema = createSchema({
    columns: [
      { id: 'name', label: 'Account' },
      { id: 'plan', type: 'enum', options: [{ value: 'pro', label: 'Pro plan' }] },
      { id: 'mrr', type: 'currency' },
    ],
  })

  it('maps headers by label or id and parses with the schema types', () => {
    const result = importRows(
      'Account,plan,MRR,extra\nAcme,Pro plan,"1,200",x\nBeta,,oops,y\n',
      schema,
    )
    expect(result.rows).toEqual([
      { name: 'Acme', plan: 'pro', mrr: 1200 },
      { name: 'Beta', plan: null },
    ])
    expect(result.issues).toEqual([
      { row: 1, column: 'mrr', value: 'oops', message: '"oops" is not a valid currency' },
    ])
  })

  it('rejects files without a matching column', () => {
    expect(() => importRows('a,b\n1,2', schema)).toThrow(TallyError)
    expect(importRows('', schema, { delimiter: ';' }).rows).toEqual([])
  })
})
