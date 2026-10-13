import { Store, type Subscription } from '@tanstack/store'
import type { Filter, GroupGranularity, Sort } from '../query/ast.ts'
import type { RowKey } from '../rows/row.ts'
import type { PinSide } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import type { AggregateName } from '../types/aggregate.ts'
import {
  defaultView,
  reconcileView,
  type ColumnState,
  type Density,
  type FormatRule,
  type View,
} from './view.ts'

export type Unsubscribe = () => void

export interface ViewStore {
  readonly schema: Schema
  get(): View
  set(view: View): void
  update(patch: Partial<View> | ((view: View) => View)): void
  subscribe(listener: (view: View) => void): Unsubscribe
  select<T>(selector: (view: View) => T, listener: (value: T) => void): Unsubscribe
  reset(): void
  setFilter(filter: Filter | undefined): void
  setSort(sort: readonly Sort[]): void
  toggleSort(column: string, additive?: boolean): void
  setGroup(column: string | undefined, granularity?: GroupGranularity): void
  setDensity(density: Density): void
  moveColumn(id: string, toIndex: number): void
  resizeColumn(id: string, width: number | undefined): void
  setColumnFlex(id: string, flex: number | undefined): void
  setColumnHidden(id: string, hidden: boolean): void
  pinColumn(id: string, side: PinSide | undefined): void
  setFooter(column: string, fn: AggregateName | undefined): void
  setRules(rules: readonly FormatRule[]): void
  togglePinnedRow(key: RowKey): void
  setExpanded(key: RowKey, expanded: boolean): void
  toggleGroupCollapsed(key: string): void
}

function moveItem<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || from >= items.length) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  if (item === undefined) return items
  copy.splice(Math.max(0, Math.min(copy.length, to)), 0, item)
  return copy
}

function updateColumn(
  columns: readonly ColumnState[],
  id: string,
  patch: (state: ColumnState) => ColumnState,
): readonly ColumnState[] {
  return columns.map((state) => (state.id === id ? patch(state) : state))
}

function toggleKey<T>(keys: readonly T[], key: T): readonly T[] {
  return keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
}

export function createViewStore(schema: Schema, initial?: View): ViewStore {
  const store = new Store<View>(
    initial === undefined ? defaultView(schema) : reconcileView(initial, schema),
  )
  const update: ViewStore['update'] = (patch) => {
    store.setState((view) => (typeof patch === 'function' ? patch(view) : { ...view, ...patch }))
  }
  const defaultDirection = (column: string): Sort['direction'] => {
    const definition = schema.column(column)
    if (definition === undefined) return 'asc'
    const kind = schema.typeOf(definition).kind
    return kind === 'number' || kind === 'date' ? 'desc' : 'asc'
  }
  return {
    schema,
    get: () => store.state,
    set: (view) => store.setState(() => reconcileView(view, schema)),
    update,
    subscribe: (listener) => {
      const subscription: Subscription = store.subscribe(() => listener(store.state))
      return () => subscription.unsubscribe()
    },
    select: (selector, listener) => {
      let previous = selector(store.state)
      const subscription = store.subscribe(() => {
        const next = selector(store.state)
        if (Object.is(next, previous)) return
        previous = next
        listener(next)
      })
      return () => subscription.unsubscribe()
    },
    reset: () => store.setState(() => defaultView(schema)),
    setFilter: (filter) => update((view) => ({ ...view, filter })),
    setSort: (sort) => update({ sort }),
    toggleSort: (column, additive = false) =>
      update((view) => {
        const first = defaultDirection(column)
        const index = view.sort.findIndex((sort) => sort.column === column)
        const existing = index === -1 ? undefined : view.sort[index]
        const flipped: Sort['direction'] = first === 'asc' ? 'desc' : 'asc'
        if (!additive) {
          if (existing === undefined || view.sort.length > 1) {
            return { ...view, sort: [{ column, direction: existing?.direction ?? first }] }
          }
          return {
            ...view,
            sort: existing.direction === first ? [{ column, direction: flipped }] : [],
          }
        }
        if (existing === undefined)
          return { ...view, sort: [...view.sort, { column, direction: first }] }
        if (existing.direction === first) {
          return { ...view, sort: view.sort.with(index, { column, direction: flipped }) }
        }
        return { ...view, sort: view.sort.filter((sort) => sort.column !== column) }
      }),
    setGroup: (column, granularity) =>
      update((view) => ({
        ...view,
        group:
          column === undefined
            ? undefined
            : { column, ...(granularity === undefined ? {} : { granularity }) },
      })),
    setDensity: (density) => update({ density }),
    moveColumn: (id, toIndex) =>
      update((view) => {
        const from = view.columns.findIndex((state) => state.id === id)
        return { ...view, columns: moveItem(view.columns, from, toIndex) }
      }),
    resizeColumn: (id, width) =>
      update((view) => ({
        ...view,
        columns: updateColumn(view.columns, id, ({ flex: _flex, width: _width, ...state }) =>
          width === undefined ? state : { ...state, width, flex: 0 },
        ),
      })),
    setColumnFlex: (id, flex) =>
      update((view) => ({
        ...view,
        columns: updateColumn(view.columns, id, ({ flex: _flex, ...state }) =>
          flex === undefined ? state : { ...state, flex },
        ),
      })),
    setColumnHidden: (id, hidden) =>
      update((view) => ({
        ...view,
        columns: updateColumn(view.columns, id, (state) => ({ ...state, hidden })),
      })),
    pinColumn: (id, side) =>
      update((view) => ({
        ...view,
        columns: updateColumn(view.columns, id, (state) => ({ ...state, pin: side })),
      })),
    setFooter: (column, fn) =>
      update((view) => {
        const { [column]: _removed, ...footer } = view.footer
        return { ...view, footer: fn === undefined ? footer : { ...footer, [column]: fn } }
      }),
    setRules: (rules) => update({ rules }),
    togglePinnedRow: (key) =>
      update((view) => ({ ...view, pinnedRows: toggleKey(view.pinnedRows, key) })),
    setExpanded: (key, expanded) =>
      update((view) => ({
        ...view,
        expanded: expanded
          ? view.expanded.includes(key)
            ? view.expanded
            : [...view.expanded, key]
          : view.expanded.filter((item) => item !== key),
      })),
    toggleGroupCollapsed: (key) =>
      update((view) => ({ ...view, collapsedGroups: toggleKey(view.collapsedGroups, key) })),
  }
}
