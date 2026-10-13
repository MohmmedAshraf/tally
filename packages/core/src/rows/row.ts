export type RowKey = string | number

export type RowData = Readonly<Record<string, unknown>>

export function isRowKey(value: unknown): value is RowKey {
  return typeof value === 'string' || typeof value === 'number'
}
