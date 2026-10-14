import { Store } from '@tanstack/store'
import type { Comparator } from '../execute/sort.ts'
import type { Schema } from '../schema/schema.ts'
import { applyMutation, isEmptyMutation, type Mutation } from './mutation.ts'
import type { RowData, RowKey } from './row.ts'

export interface RowPatch {
  readonly upserts?: readonly RowData[] | undefined
  readonly deletes?: readonly RowKey[] | undefined
}

export type ChangedCells = ReadonlyMap<RowKey, ReadonlySet<string>>

export interface RowState {
  readonly rows: readonly RowData[]
  readonly version: number
  readonly changed: ChangedCells
}

export interface RowStore {
  readonly schema: Schema
  get(): RowState
  rows(): readonly RowData[]
  byKey(key: RowKey): RowData | undefined
  subscribe(listener: (state: RowState) => void): () => void
  replace(rows: readonly RowData[]): void
  reload(rows: readonly RowData[]): void
  patch(patch: RowPatch, order?: Comparator): void
  commit(mutation: Mutation): boolean
  undo(): Mutation | undefined
  redo(): Mutation | undefined
  jumpTo(position: number): void
  revert(id: string): boolean
  canUndo(): boolean
  canRedo(): boolean
  history(): readonly Mutation[]
  position(): number
  clearChanged(): void
}

function markChanged(
  current: ChangedCells,
  schema: Schema,
  previous: Map<RowKey, RowData>,
  rows: readonly RowData[],
): ChangedCells {
  const next = new Map<RowKey, Set<string>>()
  for (const [key, columns] of current) next.set(key, new Set(columns))
  for (const row of rows) {
    const key = schema.keyOf(row)
    const before = previous.get(key)
    if (before === undefined) continue
    for (const column of schema.columns) {
      if (before[column.id] !== row[column.id]) {
        const set = next.get(key) ?? new Set<string>()
        set.add(column.id)
        next.set(key, set)
      }
    }
  }
  return next
}

export function createRowStore(schema: Schema, initial: readonly RowData[] = []): RowStore {
  let base: readonly RowData[] = initial
  let entries: Mutation[] = []
  let pointer = 0
  let basePointer = 0
  const store = new Store<RowState>({ rows: initial, version: 0, changed: new Map() })
  let index: Map<RowKey, RowData> | undefined

  const publish = (rows: readonly RowData[], changed?: ChangedCells): void => {
    index = undefined
    store.setState((state) => ({
      rows,
      version: state.version + 1,
      changed: changed ?? state.changed,
    }))
  }

  const rebuild = (): readonly RowData[] => {
    let rows = base
    if (pointer >= basePointer) {
      for (const entry of entries.slice(basePointer, pointer)) {
        rows = applyMutation(rows, entry, schema)
      }
      return rows
    }
    for (const entry of entries.slice(pointer, basePointer).toReversed()) {
      rows = applyMutation(rows, entry, schema, 'backward')
    }
    return rows
  }

  const indexed = (): Map<RowKey, RowData> => {
    index ??= new Map(store.state.rows.map((row) => [schema.keyOf(row), row] as const))
    return index
  }

  return {
    schema,
    get: () => store.state,
    rows: () => store.state.rows,
    byKey: (key) => indexed().get(key),
    subscribe: (listener) => {
      const subscription = store.subscribe(() => listener(store.state))
      return () => subscription.unsubscribe()
    },
    replace: (rows) => {
      base = rows
      entries = []
      pointer = 0
      basePointer = 0
      publish(rows, new Map())
    },
    reload: (rows) => {
      base = rows
      basePointer = pointer
      publish(rows)
    },
    patch: (patch, order) => {
      const deletes = new Set(patch.deletes ?? [])
      const upserts = new Map((patch.upserts ?? []).map((row) => [schema.keyOf(row), row] as const))
      const previous = new Map(base.map((row) => [schema.keyOf(row), row] as const))
      const kept = base
        .filter((row) => !deletes.has(schema.keyOf(row)))
        .map((row) => upserts.get(schema.keyOf(row)) ?? row)
      const known = new Set(kept.map((row) => schema.keyOf(row)))
      const added = [...upserts.values()].filter((row) => !known.has(schema.keyOf(row)))
      const merged = [...kept, ...added]
      base = order === undefined ? merged : merged.toSorted(order)
      const changed = markChanged(store.state.changed, schema, previous, base)
      publish(rebuild(), changed)
    },
    commit: (mutation) => {
      if (isEmptyMutation(mutation)) return false
      entries = [...entries.slice(0, pointer), mutation]
      pointer = entries.length
      publish(applyMutation(store.state.rows, mutation, schema))
      return true
    },
    undo: () => {
      const entry = pointer > 0 ? entries[pointer - 1] : undefined
      if (entry === undefined) return undefined
      pointer -= 1
      publish(applyMutation(store.state.rows, entry, schema, 'backward'))
      return entry
    },
    redo: () => {
      const entry = entries[pointer]
      if (entry === undefined) return undefined
      pointer += 1
      publish(applyMutation(store.state.rows, entry, schema))
      return entry
    },
    jumpTo: (position) => {
      const target = Math.max(0, Math.min(entries.length, position))
      if (target === pointer) return
      pointer = target
      publish(rebuild())
    },
    revert: (id) => {
      const at = entries.findIndex((entry) => entry.id === id)
      if (at === -1) return false
      const entry = entries[at]
      entries = entries.filter((candidate) => candidate.id !== id)
      if (at < pointer) pointer -= 1
      if (entry !== undefined && at < basePointer) {
        base = applyMutation(base, entry, schema, 'backward')
        basePointer -= 1
      }
      publish(rebuild())
      return true
    },
    canUndo: () => pointer > 0,
    canRedo: () => pointer < entries.length,
    history: () => entries,
    position: () => pointer,
    clearChanged: () => publish(store.state.rows, new Map()),
  }
}
