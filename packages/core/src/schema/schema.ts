import { TallyError } from '../errors.ts'
import { isRowKey, type RowData, type RowKey } from '../rows/row.ts'
import { createDefaultRegistry } from '../types/builtin/index.ts'
import type { ColumnType } from '../types/column-type.ts'
import type { TypeRegistry } from '../types/registry.ts'
import { columnLabel, validateColumns, type Column, type ColumnInput } from './column.ts'

export interface SchemaOptions {
  readonly columns: readonly ColumnInput[]
  readonly key?: string | ((row: RowData) => RowKey) | undefined
  readonly parent?: string | ((row: RowData) => RowKey | null | undefined) | undefined
  readonly registry?: TypeRegistry | undefined
}

export interface Schema {
  readonly columns: readonly Column[]
  readonly registry: TypeRegistry
  readonly hierarchical: boolean
  readonly keyField: string | undefined
  column(id: string): Column | undefined
  requireColumn(id: string): Column
  typeOf(column: Column): ColumnType
  resolve(name: string): Column | undefined
  names(): readonly ColumnName[]
  keyOf(row: RowData): RowKey
  parentOf(row: RowData): RowKey | null
  valueOf(row: RowData, column: Column): unknown
}

export interface ColumnName {
  readonly name: string
  readonly column: Column
}

function fieldAccessor(field: string): (row: RowData) => unknown {
  return (row) => row[field]
}

function keyAccessor(key: SchemaOptions['key']): (row: RowData) => RowKey {
  const read = typeof key === 'function' ? key : fieldAccessor(key ?? 'id')
  return (row) => {
    const value = read(row)
    if (!isRowKey(value)) {
      throw new TallyError('invalid_value', 'Row key must be a string or a number')
    }
    return value
  }
}

function parentAccessor(parent: SchemaOptions['parent']): (row: RowData) => RowKey | null {
  if (parent === undefined) return () => null
  const read = typeof parent === 'function' ? parent : fieldAccessor(parent)
  return (row) => {
    const value = read(row)
    return isRowKey(value) ? value : null
  }
}

export function createSchema(options: SchemaOptions): Schema {
  const registry = options.registry ?? createDefaultRegistry()
  const columns = validateColumns(options.columns)
  const byId = new Map<string, Column>()
  const names: ColumnName[] = []
  for (const column of columns) {
    if (!registry.has(column.type)) {
      throw new TallyError(
        'unknown_type',
        `Column "${column.id}" uses unknown type "${column.type}"`,
      )
    }
    byId.set(column.id, column)
    const candidates = new Set(
      [column.id, columnLabel(column), ...(column.aliases ?? [])].map((name) =>
        name.trim().toLowerCase(),
      ),
    )
    for (const name of candidates) names.push({ name, column })
  }
  names.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name))
  const byName = new Map(names.map((entry) => [entry.name, entry.column] as const))
  const keyOf = keyAccessor(options.key)
  const parentOf = parentAccessor(options.parent)

  return {
    columns,
    registry,
    hierarchical: options.parent !== undefined,
    column: (id) => byId.get(id),
    requireColumn: (id) => {
      const column = byId.get(id)
      if (column === undefined) throw new TallyError('unknown_column', `Unknown column "${id}"`)
      return column
    },
    typeOf: (column) => registry.get(column.type),
    resolve: (name) => byName.get(name.trim().toLowerCase()),
    names: () => names,
    keyOf,
    keyField: typeof options.key === 'function' ? undefined : (options.key ?? 'id'),
    parentOf,
    valueOf: (row, column) => row[column.id],
  }
}
