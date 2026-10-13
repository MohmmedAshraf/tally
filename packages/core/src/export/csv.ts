import Papa from 'papaparse'
import { createFormatContext, type FormatContext } from '../format/context.ts'
import type { RowData } from '../rows/row.ts'
import { columnLabel, type Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import { isEmptyValue } from '../types/column-type.ts'

export interface ExportOptions {
  readonly columns?: readonly Column[] | undefined
  readonly formatted?: boolean | undefined
  readonly header?: 'id' | 'label' | 'none' | undefined
  readonly delimiter?: string | undefined
  readonly newline?: string | undefined
  readonly format?: FormatContext | undefined
}

export function cellText(
  row: RowData,
  column: Column,
  schema: Schema,
  formatted: boolean,
  context: FormatContext,
): string {
  const value = schema.valueOf(row, column)
  if (isEmptyValue(value)) return ''
  const type = schema.typeOf(column)
  if (formatted && type.is(value)) return type.format(value, column, context)
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return JSON.stringify(value)
}

export function toDelimited(
  rows: readonly RowData[],
  schema: Schema,
  options: ExportOptions = {},
): string {
  const columns = options.columns ?? schema.columns
  const context = options.format ?? createFormatContext()
  const header = options.header ?? 'id'
  const data = rows.map((row) =>
    columns.map((column) => cellText(row, column, schema, options.formatted === true, context)),
  )
  const fields = columns.map((column) => (header === 'label' ? columnLabel(column) : column.id))
  return Papa.unparse(
    { fields, data },
    {
      header: header !== 'none',
      delimiter: options.delimiter ?? ',',
      newline: options.newline ?? '\n',
      escapeFormulae: true,
    },
  )
}

export function toCsv(
  rows: readonly RowData[],
  schema: Schema,
  options: ExportOptions = {},
): string {
  return toDelimited(rows, schema, options)
}

export function toTsv(
  rows: readonly RowData[],
  schema: Schema,
  options: ExportOptions = {},
): string {
  return toDelimited(rows, schema, { header: 'none', formatted: true, ...options, delimiter: '\t' })
}
