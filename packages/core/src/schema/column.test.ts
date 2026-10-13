import { describe, expect, it } from 'vitest'
import { TallyError } from '../errors.ts'
import { columnLabel, validateColumns } from './column.ts'

describe('validateColumns', () => {
  it('defaults the type to text and keeps the input', () => {
    const [column] = validateColumns([{ id: 'name', label: 'Name' }])
    expect(column).toEqual({ id: 'name', type: 'text', label: 'Name' })
    expect(columnLabel({ id: 'mrr', type: 'currency' })).toBe('mrr')
  })

  it('rejects bad values and duplicates', () => {
    expect(() => validateColumns([{ id: 'a', width: -1 }])).toThrow(TallyError)
    expect(() => validateColumns([{ id: 'a' }, { id: 'a' }])).toThrow('Duplicate column id')
  })

  it('requires a subtitle to name another column', () => {
    expect(() => validateColumns([{ id: 'a', subtitle: 'b' }])).toThrow('unknown subtitle')
    expect(validateColumns([{ id: 'a', subtitle: 'b' }, { id: 'b' }])).toHaveLength(2)
  })

  it('rejects unknown keys', () => {
    const withUnknownKey = { id: 'a', nope: true }
    expect(() => validateColumns([withUnknownKey])).toThrow('invalid')
  })

  it('reports the failing path', () => {
    expect(() => validateColumns([{ id: 'a', format: { currency: 'EURO' } }])).toThrow(
      expect.objectContaining({
        code: 'invalid_column',
        details: [expect.stringMatching(/format\.currency/)],
      }),
    )
  })
})
