import { describe, expect, it } from 'vitest'
import { TallyError } from '../errors.ts'
import { columnLabel, validateColumns } from './column.ts'

describe('validateColumns', () => {
  it('defaults the type to text and keeps the input', () => {
    const [column] = validateColumns([{ id: 'name', label: 'Name' }])
    expect(column).toEqual({ id: 'name', type: 'text', label: 'Name' })
    expect(columnLabel({ id: 'mrr', type: 'currency' })).toBe('mrr')
  })

  it('rejects unknown keys, bad values and duplicates', () => {
    expect(() => validateColumns([{ id: 'a', width: -1 }])).toThrow(TallyError)
    expect(() => validateColumns([{ id: 'a' }, { id: 'a' }])).toThrow('Duplicate column id')
    expect(() => validateColumns([{ id: 'a', nope: true } as unknown as { id: string }])).toThrow(
      'invalid',
    )
    try {
      validateColumns([{ id: 'a', format: { currency: 'EURO' } }])
    } catch (error) {
      expect(error).toBeInstanceOf(TallyError)
      expect((error as TallyError).code).toBe('invalid_column')
      expect((error as TallyError).details[0]).toMatch(/format\.currency/)
    }
  })
})
