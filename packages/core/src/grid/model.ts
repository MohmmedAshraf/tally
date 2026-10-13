import type { AggregateResults } from '../execute/aggregate.ts'
import { groupKeyOf, groupValueOf } from '../execute/group.ts'
import { flattenTree } from '../execute/tree.ts'
import type { RowData, RowKey } from '../rows/row.ts'
import type { Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import type { GroupSummary } from '../source/data-source.ts'
import type { View } from '../view/view.ts'

export interface GroupItem {
  readonly kind: 'group'
  readonly key: string
  readonly value: unknown
  readonly column: Column
  readonly count: number
  readonly aggregates: AggregateResults
  readonly collapsed: boolean
}

export interface RowItem {
  readonly kind: 'row'
  readonly key: RowKey
  readonly row: RowData
  readonly index: number
  readonly position: number
  readonly depth: number
  readonly hasChildren: boolean
  readonly expanded: boolean
  readonly group: string | undefined
  readonly pinned: boolean
}

export type RowModelItem = GroupItem | RowItem

export interface RowModel {
  readonly items: readonly RowModelItem[]
  readonly rows: readonly RowItem[]
  readonly pinned: readonly RowItem[]
  readonly groups: readonly GroupItem[]
}

export interface RowModelInput {
  readonly rows: readonly RowData[]
  readonly view: View
  readonly schema: Schema
  readonly groups?: readonly GroupSummary[] | undefined
  readonly offset?: number | undefined
}

export const emptyRowModel: RowModel = { items: [], rows: [], pinned: [], groups: [] }

interface Section {
  readonly group: GroupItem | undefined
  readonly rows: readonly RowData[]
}

function sections(input: RowModelInput): readonly Section[] {
  const { view, schema } = input
  const column = view.group === undefined ? undefined : schema.column(view.group.column)
  if (view.group === undefined || column === undefined) {
    return [{ group: undefined, rows: input.rows }]
  }
  const granularity = view.group.granularity ?? 'month'
  const summaries = new Map((input.groups ?? []).map((summary) => [summary.key, summary] as const))
  const collapsed = new Set(view.collapsedGroups)
  const buckets = new Map<string, { value: unknown; rows: RowData[] }>()
  for (const row of input.rows) {
    const value = groupValueOf(row, column, schema, granularity)
    const key = groupKeyOf(value)
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, { value, rows: [row] })
    else bucket.rows.push(row)
  }
  return [...buckets.entries()].map(([key, bucket]) => {
    const summary = summaries.get(key)
    return {
      group: {
        kind: 'group',
        key,
        value: bucket.value,
        column,
        count: summary?.count ?? bucket.rows.length,
        aggregates: summary?.aggregates ?? {},
        collapsed: collapsed.has(key),
      },
      rows: bucket.rows,
    }
  })
}

export function buildRowModel(input: RowModelInput): RowModel {
  const { schema, view } = input
  const pinnedKeys = new Set(view.pinnedRows)
  const expanded = new Set(view.expanded)
  const items: RowModelItem[] = []
  const rows: RowItem[] = []
  const pinned: RowItem[] = []
  const groups: GroupItem[] = []
  const push = (item: RowItem): void => {
    items.push(item)
    rows.push(item)
  }
  for (const row of input.rows) {
    const key = schema.keyOf(row)
    if (!pinnedKeys.has(key)) continue
    const item: RowItem = {
      kind: 'row',
      key,
      row,
      index: rows.length,
      position: pinned.length + 1,
      depth: 0,
      hasChildren: false,
      expanded: false,
      group: undefined,
      pinned: true,
    }
    pinned.push(item)
    push(item)
  }
  for (const section of sections(input)) {
    if (section.group !== undefined) {
      groups.push(section.group)
      items.push(section.group)
      if (section.group.collapsed) continue
    }
    const nodes = schema.hierarchical
      ? flattenTree(section.rows, schema, { expanded: (key) => expanded.has(key) })
      : section.rows.map((row) => ({
          row,
          key: schema.keyOf(row),
          depth: 0,
          hasChildren: false,
        }))
    let position = section.group === undefined ? (input.offset ?? 0) : 0
    for (const node of nodes) {
      if (pinnedKeys.has(node.key)) continue
      position += 1
      push({
        kind: 'row',
        key: node.key,
        row: node.row,
        index: rows.length,
        position,
        depth: node.depth,
        hasChildren: node.hasChildren,
        expanded: node.hasChildren && expanded.has(node.key),
        group: section.group?.key,
        pinned: false,
      })
    }
  }
  return { items, rows, pinned, groups }
}
