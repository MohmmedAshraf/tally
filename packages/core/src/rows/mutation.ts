import type { Schema } from '../schema/schema.ts'
import type { RowData, RowKey } from './row.ts'

export interface CellChange {
  readonly key: RowKey
  readonly column: string
  readonly from: unknown
  readonly to: unknown
}

export interface RowInsert {
  readonly row: RowData
  readonly index?: number | undefined
}

export interface RowDelete {
  readonly row: RowData
  readonly index: number
}

export interface Mutation {
  readonly id: string
  readonly label: string
  readonly at: number
  readonly changes: readonly CellChange[]
  readonly inserted: readonly RowInsert[]
  readonly deleted: readonly RowDelete[]
}

export interface MutationInput {
  readonly label: string
  readonly changes?: readonly CellChange[] | undefined
  readonly inserted?: readonly RowInsert[] | undefined
  readonly deleted?: readonly RowDelete[] | undefined
}

export function createMutation(input: MutationInput): Mutation {
  return {
    id: crypto.randomUUID(),
    label: input.label,
    at: Date.now(),
    changes: input.changes ?? [],
    inserted: input.inserted ?? [],
    deleted: input.deleted ?? [],
  }
}

export function isEmptyMutation(mutation: Mutation): boolean {
  return (
    mutation.changes.length === 0 && mutation.inserted.length === 0 && mutation.deleted.length === 0
  )
}

export function applyMutation(
  rows: readonly RowData[],
  mutation: Mutation,
  schema: Schema,
  direction: 'forward' | 'backward' = 'forward',
): readonly RowData[] {
  const forward = direction === 'forward'
  let next: RowData[] = [...rows]
  const removals = forward
    ? mutation.deleted
    : mutation.inserted.map((insert) => ({ row: insert.row }))
  if (removals.length > 0) {
    const keys = new Set(removals.map((removal) => schema.keyOf(removal.row)))
    next = next.filter((row) => !keys.has(schema.keyOf(row)))
  }
  const insertions = forward ? mutation.inserted : mutation.deleted
  const ordered = insertions.toSorted(
    (a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER),
  )
  for (const insertion of ordered) {
    const index = insertion.index ?? next.length
    next.splice(Math.min(index, next.length), 0, insertion.row)
  }
  if (mutation.changes.length > 0) {
    const byKey = new Map<RowKey, Record<string, unknown>>()
    for (const change of mutation.changes) {
      const patch = byKey.get(change.key) ?? {}
      patch[change.column] = forward ? change.to : change.from
      byKey.set(change.key, patch)
    }
    next = next.map((row) => {
      const patch = byKey.get(schema.keyOf(row))
      return patch === undefined ? row : { ...row, ...patch }
    })
  }
  return next
}

export function invertMutation(mutation: Mutation): Mutation {
  return {
    ...mutation,
    changes: mutation.changes.map((change) => ({ ...change, from: change.to, to: change.from })),
    inserted: mutation.deleted.map((removal) => ({ row: removal.row, index: removal.index })),
    deleted: mutation.inserted.map((insert, position) => ({
      row: insert.row,
      index: insert.index ?? position,
    })),
  }
}
