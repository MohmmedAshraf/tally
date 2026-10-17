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
  replaced: readonly (readonly [RowData, RowData])[],
): ChangedCells {
  let next: Map<RowKey, ReadonlySet<string>> | undefined
  for (const [before, row] of replaced) {
    const columns = schema.columns.filter((column) => before[column.id] !== row[column.id])
    if (columns.length === 0) continue
    const key = schema.keyOf(row)
    next ??= new Map(current)
    next.set(key, new Set([...(current.get(key) ?? []), ...columns.map((column) => column.id)]))
  }
  return next ?? current
}

interface Positioned {
  readonly row: RowData
  readonly index: number
}

function insertSorted(
  rows: readonly RowData[],
  dirty: ReadonlySet<number>,
  order: Comparator,
): readonly RowData[] {
  if (dirty.size === 0) return rows
  const clean: Positioned[] = []
  const pending: Positioned[] = []
  for (const [index, row] of rows.entries())
    (dirty.has(index) ? pending : clean).push({ row, index })
  const compare = (a: Positioned, b: Positioned): number => order(a.row, b.row) || a.index - b.index
  const output: RowData[] = []
  let cursor = 0
  for (const entry of pending.toSorted(compare)) {
    let low = cursor
    let high = clean.length
    while (low < high) {
      const middle = (low + high) >>> 1
      const candidate = clean[middle]
      if (candidate !== undefined && compare(candidate, entry) < 0) low = middle + 1
      else high = middle
    }
    for (const kept of clean.slice(cursor, low)) output.push(kept.row)
    output.push(entry.row)
    cursor = low
  }
  for (const kept of clean.slice(cursor)) output.push(kept.row)
  return output
}

export function createRowStore(schema: Schema, initial: readonly RowData[] = []): RowStore {
  let base: readonly RowData[] = initial
  let entries: Mutation[] = []
  let pointer = 0
  let basePointer = 0
  let sortedBy: Comparator | undefined
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
      sortedBy = undefined
      entries = []
      pointer = 0
      basePointer = 0
      publish(rows, new Map())
    },
    reload: (rows) => {
      base = rows
      sortedBy = undefined
      basePointer = pointer
      publish(rows)
    },
    patch: (patch, order) => {
      const deletes = new Set(patch.deletes ?? [])
      const upserts = new Map((patch.upserts ?? []).map((row) => [schema.keyOf(row), row] as const))
      const merged: RowData[] = []
      const dirty = new Set<number>()
      const replaced: (readonly [RowData, RowData])[] = []
      const seen = new Set<RowKey>()
      for (const row of base) {
        const key = schema.keyOf(row)
        if (deletes.has(key)) continue
        const next = upserts.get(key)
        if (next === undefined) {
          merged.push(row)
          continue
        }
        seen.add(key)
        replaced.push([row, next])
        dirty.add(merged.length)
        merged.push(next)
      }
      for (const [key, row] of upserts) {
        if (seen.has(key)) continue
        dirty.add(merged.length)
        merged.push(row)
      }
      base =
        order === undefined
          ? merged
          : order === sortedBy
            ? insertSorted(merged, dirty, order)
            : merged.toSorted(order)
      sortedBy = order
      publish(rebuild(), markChanged(store.state.changed, schema, replaced))
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
        sortedBy = undefined
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
