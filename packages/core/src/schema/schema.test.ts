import { describe, expect, it } from 'vitest'
import { createSchema } from './schema.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account', aliases: ['customer'] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'owner', label: 'Account Owner', type: 'person' },
  ],
  parent: 'parentId',
})

describe('createSchema', () => {
  it('resolves ids, labels and aliases case-insensitively', () => {
    expect(schema.resolve('MRR')?.id).toBe('mrr')
    expect(schema.resolve('customer')?.id).toBe('account')
    expect(schema.resolve(' account owner ')?.id).toBe('owner')
    expect(schema.resolve('nope')).toBeUndefined()
    expect(schema.names().map((entry) => entry.name)).toEqual([
      'account owner',
      'customer',
      'account',
      'owner',
      'mrr',
    ])
  })

  it('extends the schema with columns at a position', () => {
    const extended = schema.extend([{ id: 'risk', type: 'enum', ai: true }], 1)
    expect(extended.columns.map((column) => column.id)).toEqual([
      'account',
      'risk',
      ...schema.columns.slice(1).map((column) => column.id),
    ])
    expect(extended.column('risk')?.ai).toBe(true)
    expect(extended.keyField).toBe(schema.keyField)
    expect(schema.column('risk')).toBeUndefined()
  })

  it('reads keys, parents and values', () => {
    const row = { id: 7, parentId: 'root', mrr: 1200 }
    expect(schema.keyOf(row)).toBe(7)
    expect(schema.parentOf(row)).toBe('root')
    expect(schema.parentOf({ id: 1 })).toBeNull()
    expect(schema.valueOf(row, schema.requireColumn('mrr'))).toBe(1200)
    expect(schema.hierarchical).toBe(true)
    expect(() => schema.keyOf({})).toThrow('Row key')
    expect(() => schema.requireColumn('x')).toThrow('Unknown column')
  })

  it('supports accessor functions and rejects unknown types', () => {
    const custom = createSchema({
      columns: [{ id: 'name' }],
      key: (row) => String(row['uuid']),
    })
    expect(custom.keyOf({ uuid: 'abc' })).toBe('abc')
    expect(custom.hierarchical).toBe(false)
    expect(() => createSchema({ columns: [{ id: 'x', type: 'geo' }] })).toThrow('unknown type')
    expect(schema.typeOf(schema.requireColumn('mrr')).name).toBe('currency')
  })
})
