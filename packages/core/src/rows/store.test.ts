import { describe, expect, it } from 'vitest'
import { compileSort } from '../execute/sort.ts'
import { createExecutionContext } from '../execute/context.ts'
import { createStressRows, createStressSchema, seeded, stressRow } from '../test/stress.ts'
import { createSchema } from '../schema/schema.ts'
import { applyMutation, createMutation, invertMutation, isEmptyMutation } from './mutation.ts'
import type { RowData, RowKey } from './row.ts'
import { createRowStore } from './store.ts'

const schema = createSchema({
  columns: [{ id: 'name' }, { id: 'mrr', type: 'currency' }, { id: 'seats', type: 'int' }],
})

const rows = [
  { id: 'a', name: 'North', mrr: 100, seats: 1 },
  { id: 'b', name: 'Blue', mrr: 200, seats: 2 },
  { id: 'c', name: 'Iron', mrr: 300, seats: 3 },
]

describe('applyMutation', () => {
  it('applies and reverses cell changes without touching inputs', () => {
    const mutation = createMutation({
      label: 'Edit',
      changes: [{ key: 'b', column: 'mrr', from: 200, to: 250 }],
    })
    const next = applyMutation(rows, mutation, schema)
    expect(next[1]).toEqual({ id: 'b', name: 'Blue', mrr: 250, seats: 2 })
    expect(rows[1]?.mrr).toBe(200)
    expect(next[0]).toBe(rows[0])
    expect(applyMutation(next, mutation, schema, 'backward')).toEqual(rows)
  })

  it('deletes and restores rows at their index', () => {
    const mutation = createMutation({
      label: 'Delete',
      deleted: [
        { row: rows[0]!, index: 0 },
        { row: rows[2]!, index: 2 },
      ],
    })
    const next = applyMutation(rows, mutation, schema)
    expect(next.map((row) => row['id'])).toEqual(['b'])
    expect(applyMutation(next, mutation, schema, 'backward').map((row) => row['id'])).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('inserts rows at an index or at the end', () => {
    const mutation = createMutation({
      label: 'Add',
      inserted: [{ row: { id: 'z' }, index: 1 }, { row: { id: 'y' } }],
    })
    const next = applyMutation(rows, mutation, schema)
    expect(next.map((row) => row['id'])).toEqual(['a', 'z', 'b', 'c', 'y'])
    expect(applyMutation(next, mutation, schema, 'backward')).toEqual(rows)
    const inverted = invertMutation(mutation)
    expect(inverted.deleted.map((removal) => removal.row['id'])).toEqual(['z', 'y'])
    expect(applyMutation(next, inverted, schema)).toEqual(rows)
  })

  it('detects empty mutations', () => {
    expect(isEmptyMutation(createMutation({ label: 'Nothing' }))).toBe(true)
    expect(createMutation({ label: 'x' }).id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('createRowStore', () => {
  it('commits, undoes, redoes and truncates the redo branch', () => {
    const store = createRowStore(schema, rows)
    const first = createMutation({
      label: 'First',
      changes: [{ key: 'a', column: 'mrr', from: 100, to: 110 }],
    })
    const second = createMutation({
      label: 'Second',
      changes: [{ key: 'a', column: 'mrr', from: 110, to: 120 }],
    })
    expect(store.commit(first)).toBe(true)
    expect(store.commit(second)).toBe(true)
    expect(store.commit(createMutation({ label: 'Empty' }))).toBe(false)
    expect(store.byKey('a')?.['mrr']).toBe(120)
    expect(store.undo()?.label).toBe('Second')
    expect(store.byKey('a')?.['mrr']).toBe(110)
    expect(store.canRedo()).toBe(true)
    const third = createMutation({
      label: 'Third',
      changes: [{ key: 'a', column: 'seats', from: 1, to: 9 }],
    })
    store.commit(third)
    expect(store.history().map((entry) => entry.label)).toEqual(['First', 'Third'])
    expect(store.redo()).toBeUndefined()
    store.undo()
    store.undo()
    expect(store.undo()).toBeUndefined()
    expect(store.rows()).toEqual(rows)
    expect(store.redo()?.label).toBe('First')
    expect(store.position()).toBe(1)
    expect(store.get().version).toBeGreaterThan(0)
  })

  it('jumps through history and reverts a single entry', () => {
    const store = createRowStore(schema, rows)
    const first = createMutation({
      label: 'First',
      changes: [{ key: 'a', column: 'mrr', from: 100, to: 110 }],
    })
    const second = createMutation({
      label: 'Second',
      changes: [{ key: 'b', column: 'mrr', from: 200, to: 220 }],
    })
    store.commit(first)
    store.commit(second)
    store.jumpTo(0)
    expect(store.rows()).toEqual(rows)
    store.jumpTo(99)
    expect(store.byKey('b')?.['mrr']).toBe(220)
    expect(store.revert(first.id)).toBe(true)
    expect(store.revert('nope')).toBe(false)
    expect(store.byKey('a')?.['mrr']).toBe(100)
    expect(store.byKey('b')?.['mrr']).toBe(220)
    expect(store.history()).toHaveLength(1)
    expect(store.canUndo()).toBe(true)
  })

  it('applies live patches under pending edits and tracks changed cells', () => {
    const store = createRowStore(schema, rows)
    const edit = createMutation({
      label: 'Edit',
      changes: [{ key: 'a', column: 'seats', from: 1, to: 5 }],
    })
    store.commit(edit)
    store.patch({
      upserts: [
        { id: 'a', name: 'North', mrr: 150, seats: 1 },
        { id: 'd', name: 'New', mrr: 1, seats: 1 },
      ],
      deletes: ['c'],
    })
    expect(store.rows().map((row) => row['id'])).toEqual(['a', 'b', 'd'])
    expect(store.byKey('a')).toEqual({ id: 'a', name: 'North', mrr: 150, seats: 5 })
    expect(store.get().changed.get('a')).toEqual(new Set(['mrr']))
    expect(store.get().changed.has('d')).toBe(false)
    store.undo()
    expect(store.byKey('a')?.['seats']).toBe(1)
    store.clearChanged()
    expect(store.get().changed.size).toBe(0)
  })

  it('replaces the dataset and notifies subscribers', () => {
    const store = createRowStore(schema, rows)
    const versions: number[] = []
    const stop = store.subscribe((state) => versions.push(state.version))
    store.commit(
      createMutation({ label: 'Edit', changes: [{ key: 'a', column: 'mrr', from: 100, to: 1 }] }),
    )
    store.replace([{ id: 'x', name: 'X', mrr: 0, seats: 0 }])
    stop()
    store.undo()
    expect(versions).toEqual([1, 2])
    expect(store.rows()).toHaveLength(1)
    expect(store.canUndo()).toBe(false)
  })

  it('keeps history across a reload so undo still reverses accepted edits', () => {
    const store = createRowStore(schema, rows)
    const edit = createMutation({
      label: 'Edit',
      changes: [{ key: 'a', column: 'mrr', from: 100, to: 1 }],
    })
    const insert = createMutation({ label: 'Add', inserted: [{ row: { id: 'n', name: 'N' } }] })
    store.commit(edit)
    store.commit(insert)
    store.reload([
      { id: 'a', name: 'A', mrr: 1, seats: 1 },
      { id: 'n', name: 'N' },
    ])
    expect(store.canUndo()).toBe(true)
    expect(store.undo()).toBe(insert)
    expect(store.rows().map((row) => row['id'])).toEqual(['a'])
    expect(store.undo()).toBe(edit)
    expect(store.byKey('a')?.['mrr']).toBe(100)
    store.jumpTo(2)
    expect(store.rows().map((row) => row['id'])).toEqual(['a', 'n'])
    expect(store.byKey('a')?.['mrr']).toBe(1)
    expect(store.revert(edit.id)).toBe(true)
    expect(store.byKey('a')?.['mrr']).toBe(100)
    expect(store.rows().map((row) => row['id'])).toEqual(['a', 'n'])
    expect(store.history()).toEqual([insert])
  })
})

describe('sorted live patches', () => {
  const stress = createStressSchema()
  const order = compileSort(
    [{ column: 'enum1', direction: 'asc' }],
    stress,
    createExecutionContext(),
  )!
  const reference = (
    base: readonly RowData[],
    upserts: readonly RowData[],
    deletes: readonly RowKey[],
  ): readonly RowData[] => {
    const byKey = new Map(upserts.map((row) => [row['id'], row] as const))
    const kept = base
      .filter((row) => !deletes.includes(stress.keyOf(row)))
      .map((row) => byKey.get(row['id']) ?? row)
    const known = new Set(kept.map((row) => row['id']))
    return [...kept, ...upserts.filter((row) => !known.has(row['id']))].toSorted(order)
  }

  it('matches a stable full re-sort while patching rows in place', () => {
    const initial = createStressRows(600, 3)
    const store = createRowStore(stress, initial)
    const random = seeded(11)
    let expected = initial
    for (let round = 0; round < 25; round += 1) {
      const current = store.rows()
      const upserts = Array.from({ length: 12 }, (): RowData => {
        const row = current[Math.floor(random() * current.length)]!
        return random() < 0.5 ? { ...row, int1: round } : { ...row, enum1: `e1-${round % 4}` }
      })
      const added = stressRow(random, 10_000 + round)
      const deletes = [stress.keyOf(current[Math.floor(random() * current.length)]!)]
      const unique = [...new Map([...upserts, added].map((row) => [row['id'], row])).values()]
      store.patch({ upserts: unique, deletes }, order)
      expected = reference(expected, unique, deletes)
      expect(store.rows().map((row) => row['id'])).toEqual(expected.map((row) => row['id']))
    }
    expect(store.get().changed.size).toBeGreaterThan(0)
  })
})
