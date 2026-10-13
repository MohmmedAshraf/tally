import type { RowData, RowKey } from '../rows/row.ts'
import type { Schema } from '../schema/schema.ts'
import type { Comparator } from './sort.ts'

export interface TreeNode {
  readonly row: RowData
  readonly key: RowKey
  readonly depth: number
  readonly hasChildren: boolean
  readonly matched: boolean
}

export interface TreeOptions {
  readonly matched?: ReadonlySet<RowKey> | undefined
  readonly expanded?: ((key: RowKey, depth: number) => boolean) | undefined
  readonly compare?: Comparator | undefined
}

export function withAncestors(
  rows: readonly RowData[],
  matched: readonly RowData[],
  schema: Schema,
): readonly RowData[] {
  const byKey = new Map<RowKey, RowData>()
  for (const row of rows) byKey.set(schema.keyOf(row), row)
  const keep = new Set<RowKey>()
  for (const row of matched) {
    let current: RowData | undefined = row
    while (current !== undefined) {
      const key = schema.keyOf(current)
      if (keep.has(key)) break
      keep.add(key)
      const parent = schema.parentOf(current)
      current = parent === null ? undefined : byKey.get(parent)
    }
  }
  return rows.filter((row) => keep.has(schema.keyOf(row)))
}

export function flattenTree(
  rows: readonly RowData[],
  schema: Schema,
  options: TreeOptions = {},
): readonly TreeNode[] {
  const children = new Map<RowKey | null, RowData[]>()
  const keys = new Set(rows.map((row) => schema.keyOf(row)))
  for (const row of rows) {
    const parent = schema.parentOf(row)
    const bucket = parent !== null && keys.has(parent) ? parent : null
    const list = children.get(bucket)
    if (list === undefined) children.set(bucket, [row])
    else list.push(row)
  }
  const expanded = options.expanded ?? ((_key: RowKey, depth: number) => depth < 1)
  const output: TreeNode[] = []
  const walk = (parent: RowKey | null, depth: number): void => {
    let list = children.get(parent) ?? []
    if (options.compare !== undefined) list = list.toSorted(options.compare)
    for (const row of list) {
      const key = schema.keyOf(row)
      const hasChildren = (children.get(key)?.length ?? 0) > 0
      output.push({
        row,
        key,
        depth,
        hasChildren,
        matched: options.matched === undefined ? true : options.matched.has(key),
      })
      if (hasChildren && expanded(key, depth)) walk(key, depth + 1)
    }
  }
  walk(null, 0)
  return output
}
