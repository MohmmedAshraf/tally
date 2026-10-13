import { Store } from '@tanstack/store'
import { TallyError } from '../errors.ts'
import type { AggregateResults } from '../execute/aggregate.ts'
import {
  createExecutionContext,
  type ExecutionContext,
  type FlagResolver,
} from '../execute/context.ts'
import { execute, type ExecuteRequest, type ExecutorOptions } from '../execute/executor.ts'
import type { Facets } from '../execute/facets.ts'
import { createMutation, invertMutation, type CellChange, type Mutation } from '../rows/mutation.ts'
import type { RowData, RowKey } from '../rows/row.ts'
import { createRowStore, type RowStore } from '../rows/store.ts'
import { columnLabel } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import {
  emptySelection,
  reduceSelection,
  type GridGeometry,
  type SelectionAction,
  type SelectionState,
} from '../selection/selection.ts'
import type {
  Capabilities,
  CursorPage,
  DataSource,
  GroupSummary,
  MutationResult,
  OffsetPage,
  QueryResponse,
} from '../source/data-source.ts'
import { createViewStore, type Unsubscribe, type ViewStore } from '../view/store.ts'
import type { View } from '../view/view.ts'
import { layoutColumns, type ColumnLayout } from './columns.ts'
import { buildRowModel, type RowModel } from './model.ts'
import { planQuery } from './plan.ts'

export type GridStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface GridPage {
  readonly index: number
  readonly size: number
}

export interface GridState {
  readonly status: GridStatus
  readonly error: unknown
  readonly total: number | undefined
  readonly matched: number | undefined
  readonly groups: readonly GroupSummary[] | undefined
  readonly aggregates: AggregateResults | undefined
  readonly facets: Facets | undefined
  readonly page: GridPage
  readonly cursor: string | undefined
  readonly exhausted: boolean
}

export interface CellEdit {
  readonly key: RowKey
  readonly column: string
  readonly value: unknown
}

export interface SelectionStore {
  get(): SelectionState
  subscribe(listener: (state: SelectionState) => void): Unsubscribe
  dispatch(action: SelectionAction): void
  geometry(): GridGeometry
}

export interface GridOptions extends ExecutorOptions {
  readonly schema: Schema
  readonly source: DataSource
  readonly view?: View | undefined
  readonly pageSize?: number | undefined
  readonly newRow?: (() => RowData) | undefined
}

export interface Grid {
  readonly schema: Schema
  readonly source: DataSource
  readonly capabilities: Capabilities
  readonly context: ExecutionContext
  readonly view: ViewStore
  readonly rows: RowStore
  readonly selection: SelectionStore
  get(): GridState
  subscribe(listener: (state: GridState) => void): Unsubscribe
  layout(): ColumnLayout
  model(): RowModel
  load(): Promise<void>
  loadMore(): Promise<void>
  setPage(index: number): void
  commit(mutation: Mutation): Promise<MutationResult>
  setCells(edits: readonly CellEdit[]): Promise<MutationResult>
  newRow(): RowData
  insertRows(rows: readonly RowData[], index?: number): Promise<MutationResult>
  deleteRows(keys: readonly RowKey[]): Promise<MutationResult>
  undo(): Promise<Mutation | undefined>
  redo(): Promise<Mutation | undefined>
  dispose(): void
}

const DEFAULT_PAGE_SIZE = 100

const accepted: MutationResult = { accepted: true }

function queryKey(view: View): string {
  return JSON.stringify([view.filter, view.sort, view.group, view.footer])
}

function memo<Input extends readonly unknown[], Output>(
  inputs: () => Input,
  compute: (inputs: Input) => Output,
): () => Output {
  let cached: { readonly inputs: Input; readonly output: Output } | undefined
  return () => {
    const next = inputs()
    const last = cached
    if (last !== undefined && next.every((value, index) => Object.is(value, last.inputs[index]))) {
      return last.output
    }
    const output = compute(next)
    cached = { inputs: next, output }
    return output
  }
}

function summarize(
  response: QueryResponse,
  local: ExecuteRequest,
  schema: Schema,
  options: ExecutorOptions,
): QueryResponse {
  const result = execute(response.rows, local, schema, options)
  return {
    ...response,
    rows: result.rows,
    ...(local.filter === undefined ? {} : { matched: result.matched }),
    ...(result.groups === undefined
      ? {}
      : {
          groups: result.groups.map((group) => ({
            key: group.key,
            value: group.value,
            count: group.rows.length,
            aggregates: group.aggregates,
          })),
        }),
    ...(result.aggregates === undefined
      ? {}
      : { aggregates: { ...response.aggregates, ...result.aggregates } }),
    ...(result.facets === undefined ? {} : { facets: { ...response.facets, ...result.facets } }),
  }
}

function describe(result: MutationResult | undefined): MutationResult {
  return result ?? accepted
}

function failure(error: unknown): MutationResult {
  return {
    accepted: false,
    errors: [{ message: error instanceof Error ? error.message : String(error) }],
  }
}

export function createGrid(options: GridOptions): Grid {
  const { schema, source } = options
  const capabilities = source.capabilities
  const rows = createRowStore(schema)
  const flags: FlagResolver = (name, row) =>
    name === 'changed'
      ? rows.get().changed.has(schema.keyOf(row))
      : (options.flags?.(name, row) ?? false)
  const executorOptions: ExecutorOptions = { ...options, flags }
  const context = createExecutionContext(executorOptions)
  const view = createViewStore(schema, options.view)
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const store = new Store<GridState>({
    status: 'idle',
    error: undefined,
    total: undefined,
    matched: undefined,
    groups: undefined,
    aggregates: undefined,
    facets: undefined,
    page: { index: 0, size: pageSize },
    cursor: undefined,
    exhausted: false,
  })
  const selectionStore = new Store<SelectionState>(emptySelection)
  const patch = (partial: Partial<GridState>): void =>
    store.setState((state) => ({ ...state, ...partial }))

  const layout = memo(
    () => [view.get()] as const,
    ([current]) => layoutColumns(current, schema),
  )
  const model = memo(
    () => [rows.get().rows, view.get(), store.state.groups, store.state.page] as const,
    ([data, current, groups, page]) =>
      buildRowModel({
        rows: data,
        view: current,
        schema,
        groups,
        offset: capabilities.pagination === 'offset' ? page.index * page.size : 0,
      }),
  )
  const geometry = (): GridGeometry => ({
    rowCount: model().rows.length,
    columnCount: layout().columns.length,
    rowKeyAt: (index) => model().rows[index]?.key,
  })

  let started = false
  let sequence = 0
  let controller: AbortController | undefined
  let stopLive: (() => void) | undefined
  let stopView: (() => void) | undefined

  const pageFor = (): OffsetPage | CursorPage | undefined => {
    const { page } = store.state
    switch (capabilities.pagination) {
      case 'offset':
        return { offset: page.index * page.size, limit: page.size }
      case 'cursor':
        return { limit: page.size }
      case 'none':
        return undefined
    }
  }

  const run = async (
    page: OffsetPage | CursorPage | undefined,
    apply: (response: QueryResponse) => void,
  ): Promise<void> => {
    if (!started) {
      started = true
      stopLive = source.subscribe?.((incoming) => rows.patch(incoming))
      stopView = view.select(queryKey, () => {
        store.setState((state) => ({ ...state, page: { ...state.page, index: 0 } }))
        void load()
      })
    }
    controller?.abort()
    const current = new AbortController()
    controller = current
    sequence += 1
    const id = sequence
    patch({ status: 'loading' })
    const plan = planQuery(view.get(), schema, capabilities, page)
    try {
      const response = await source.query(plan.request, current.signal)
      if (id !== sequence) return
      apply(
        plan.local === undefined
          ? response
          : summarize(response, plan.local, schema, executorOptions),
      )
    } catch (error) {
      if (id !== sequence) return
      patch({ status: 'error', error })
    }
  }

  const settle = (response: QueryResponse): Partial<GridState> => ({
    status: 'ready',
    error: undefined,
    total: response.total,
    matched: response.matched,
    groups: response.groups,
    aggregates: response.aggregates,
    facets: response.facets,
    cursor: response.cursor,
    exhausted: capabilities.pagination !== 'cursor' || response.cursor === undefined,
  })

  const load = (): Promise<void> =>
    run(pageFor(), (response) => {
      rows.reload(response.rows)
      patch(settle(response))
    })

  const loadMore = (): Promise<void> => {
    const { cursor, exhausted, status } = store.state
    if (capabilities.pagination !== 'cursor' || exhausted || status === 'loading') {
      return Promise.resolve()
    }
    return run({ cursor, limit: pageSize }, (response) => {
      rows.reload([...rows.rows(), ...response.rows])
      patch(settle(response))
    })
  }

  const send = async (mutation: Mutation, rollback: () => void): Promise<MutationResult> => {
    if (source.mutate === undefined) return accepted
    try {
      const result = describe(await source.mutate([mutation]))
      if (!result.accepted) rollback()
      return result
    } catch (error) {
      rollback()
      return failure(error)
    }
  }

  const commit = (mutation: Mutation): Promise<MutationResult> => {
    if (!rows.commit(mutation)) return Promise.resolve(accepted)
    return send(mutation, () => rows.revert(mutation.id))
  }

  return {
    schema,
    source,
    capabilities,
    context,
    view,
    rows,
    selection: {
      get: () => selectionStore.state,
      subscribe: (listener) => {
        const subscription = selectionStore.subscribe(() => listener(selectionStore.state))
        return () => subscription.unsubscribe()
      },
      dispatch: (action) =>
        selectionStore.setState((state) => reduceSelection(state, action, geometry())),
      geometry,
    },
    get: () => store.state,
    subscribe: (listener) => {
      const subscription = store.subscribe(() => listener(store.state))
      return () => subscription.unsubscribe()
    },
    layout,
    model,
    load,
    loadMore,
    setPage: (index) => {
      store.setState((state) => ({ ...state, page: { ...state.page, index: Math.max(0, index) } }))
      void load()
    },
    commit,
    setCells: (edits) => {
      const changes: CellChange[] = []
      for (const edit of edits) {
        const column = schema.column(edit.column)
        const row = rows.byKey(edit.key)
        if (column === undefined || row === undefined) continue
        const type = schema.typeOf(column)
        const from = schema.valueOf(row, column)
        const to =
          edit.value === null || edit.value === undefined || edit.value === ''
            ? null
            : type.parse(edit.value, column)
        if (to === undefined || Object.is(from, to)) continue
        changes.push({ key: edit.key, column: column.id, from, to })
      }
      const first = changes[0]
      if (first === undefined) return Promise.resolve(accepted)
      const target = schema.column(first.column)
      const label =
        changes.length === 1 && target !== undefined
          ? `Edit ${columnLabel(target)}`
          : `Edit ${changes.length} cells`
      return commit(createMutation({ label, changes }))
    },
    newRow: () => {
      if (options.newRow !== undefined) return options.newRow()
      if (schema.keyField === undefined) {
        throw new TallyError('invalid_value', 'Provide newRow to create rows with a custom key')
      }
      return { [schema.keyField]: crypto.randomUUID() }
    },
    insertRows: (inserted, index) =>
      commit(
        createMutation({
          label: inserted.length === 1 ? 'Add row' : `Add ${inserted.length} rows`,
          inserted: inserted.map((row, offset) => ({
            row,
            ...(index === undefined ? {} : { index: index + offset }),
          })),
        }),
      ),
    deleteRows: (keys) => {
      const wanted = new Set(keys)
      const deleted = rows
        .rows()
        .map((row, index) => ({ row, index }))
        .filter((entry) => wanted.has(schema.keyOf(entry.row)))
      return commit(
        createMutation({
          label: deleted.length === 1 ? 'Delete row' : `Delete ${deleted.length} rows`,
          deleted,
        }),
      )
    },
    undo: async () => {
      const mutation = rows.undo()
      if (mutation === undefined) return undefined
      await send(invertMutation(mutation), () => rows.redo())
      return mutation
    },
    redo: async () => {
      const mutation = rows.redo()
      if (mutation === undefined) return undefined
      await send(mutation, () => rows.undo())
      return mutation
    },
    dispose: () => {
      controller?.abort()
      sequence += 1
      stopView?.()
      stopLive?.()
      stopView = undefined
      stopLive = undefined
      started = false
    },
  }
}
