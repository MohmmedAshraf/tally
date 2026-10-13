import {
  createArraySource,
  type ArraySourceOptions,
  type Capabilities,
  type DataSource,
  type Mutation,
  type MutationResult,
  type QueryRequest,
  type QueryResponse,
  type RowData,
  type RowKey,
  type RowPatch,
  type Schema,
} from 'tally-core'

export interface CollectionChange {
  readonly type: 'insert' | 'update' | 'delete'
  readonly key: RowKey
  readonly value: RowData
}

export interface CollectionTransaction {
  readonly isPersisted: { readonly promise: Promise<unknown> }
}

export interface CollectionLike {
  readonly toArray: readonly RowData[]
  get(key: RowKey): RowData | undefined
  preload(): Promise<void>
  subscribeChanges(
    callback: (changes: readonly CollectionChange[]) => void,
    options: { readonly includeInitialState: boolean },
  ): { unsubscribe(): void }
  insert(data: RowData | RowData[]): CollectionTransaction
  update(key: RowKey, callback: (draft: RowData) => void): CollectionTransaction
  delete(keys: RowKey | RowKey[]): CollectionTransaction
}

export interface CollectionSourceOptions extends Omit<ArraySourceOptions, 'pagination'> {
  readonly item?: ((row: RowData) => RowData) | undefined
}

export interface CollectionSource extends DataSource {
  rows(): readonly RowData[]
}

function rowOf(item: RowData): RowData {
  return Object.fromEntries(Object.entries(item).filter(([name]) => !name.startsWith('$')))
}

function patchOf(changes: readonly CollectionChange[]): RowPatch {
  const upserts = changes.filter((change) => change.type !== 'delete').map((c) => rowOf(c.value))
  const deletes = changes.filter((change) => change.type === 'delete').map((change) => change.key)
  return {
    ...(upserts.length === 0 ? {} : { upserts }),
    ...(deletes.length === 0 ? {} : { deletes }),
  }
}

async function persist(transactions: readonly CollectionTransaction[]): Promise<void> {
  await Promise.all(transactions.map((transaction) => transaction.isPersisted.promise))
}

export function createCollectionSource(
  collection: CollectionLike,
  schema: Schema,
  options: CollectionSourceOptions = {},
): CollectionSource {
  const { item = rowOf, mutable, ...executor } = options
  const array = createArraySource([], schema, { ...executor, mutable: false })
  const capabilities: Capabilities = {
    ...array.capabilities,
    mutate: mutable !== false,
    live: true,
  }
  const snapshot = (): readonly RowData[] => collection.toArray.map(rowOf)
  const listeners = new Set<(patch: RowPatch) => void>()
  let subscription: { unsubscribe(): void } | undefined
  const tracking = (): boolean => subscription !== undefined
  const query = async (request: QueryRequest): Promise<QueryResponse> => {
    await collection.preload()
    if (!tracking()) array.replace(snapshot())
    return array.query(request)
  }
  const subscribe = (onPatch: (patch: RowPatch) => void): (() => void) => {
    if (!tracking()) {
      let primed = false
      array.replace([])
      subscription = collection.subscribeChanges(
        (changes) => {
          const patch = patchOf(changes)
          array.patch(patch)
          if (primed) for (const listener of listeners) listener(patch)
        },
        { includeInitialState: true },
      )
      primed = true
    }
    listeners.add(onPatch)
    return () => {
      listeners.delete(onPatch)
      if (listeners.size === 0) {
        subscription?.unsubscribe()
        subscription = undefined
      }
    }
  }
  const apply = (mutation: Mutation): readonly CollectionTransaction[] => {
    const transactions: CollectionTransaction[] = []
    const deletes = mutation.deleted.map((removal) => schema.keyOf(removal.row))
    if (deletes.length > 0) transactions.push(collection.delete(deletes))
    const inserts = mutation.inserted.map((insert) => item(insert.row))
    if (inserts.length > 0) transactions.push(collection.insert(inserts))
    const patches = new Map<RowKey, Record<string, unknown>>()
    for (const change of mutation.changes) {
      patches.set(change.key, { ...patches.get(change.key), [change.column]: change.to })
    }
    for (const [key, patch] of patches) {
      transactions.push(collection.update(key, (draft) => Object.assign(draft, patch)))
    }
    return transactions
  }
  const mutate = async (mutations: readonly Mutation[]): Promise<MutationResult> => {
    if (!capabilities.mutate) {
      return { accepted: false, errors: [{ message: 'Source is read only' }] }
    }
    try {
      await persist(mutations.flatMap(apply))
    } catch (error) {
      return {
        accepted: false,
        errors: [{ message: error instanceof Error ? error.message : 'Mutation failed' }],
      }
    }
    const touched = [
      ...new Set(
        mutations.flatMap((mutation) => [
          ...mutation.changes.map((change) => change.key),
          ...mutation.inserted.map((insert) => schema.keyOf(insert.row)),
        ]),
      ),
    ]
    const rows = touched.flatMap((key) => {
      const current = collection.get(key)
      return current === undefined ? [] : [rowOf(current)]
    })
    return { accepted: true, rows }
  }
  return {
    capabilities,
    rows: () => (tracking() ? array.rows() : snapshot()),
    schema: () => Promise.resolve(schema.columns),
    query,
    mutate,
    subscribe,
  }
}
