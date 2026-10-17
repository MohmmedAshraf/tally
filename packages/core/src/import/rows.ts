import Papa from 'papaparse'
import { TallyError } from '../errors.ts'
import type { RowData } from '../rows/row.ts'
import type { Schema } from '../schema/schema.ts'
import { cell, slugifyHeader, type ImportIssue, type ImportOptions } from './csv.ts'

export interface RowsImport {
  readonly rows: readonly RowData[]
  readonly issues: readonly ImportIssue[]
}

export function importRows(
  text: string,
  schema: Schema,
  options: Pick<ImportOptions, 'delimiter'> = {},
): RowsImport {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    ...(options.delimiter === undefined ? {} : { delimiter: options.delimiter }),
  })
  const [header = [], ...records] = parsed.data
  const columns = header.map(
    (name, index) => schema.resolve(name.trim()) ?? schema.column(slugifyHeader(name, index)),
  )
  if (records.length > 0 && columns.every((column) => column === undefined)) {
    throw new TallyError('unknown_column', 'No CSV column matches the schema', header)
  }
  const issues: ImportIssue[] = []
  const rows = records.map((record, rowIndex) => {
    const row: Record<string, unknown> = {}
    for (const [index, column] of columns.entries()) {
      if (column === undefined) continue
      const raw = cell(record, index)
      if (raw === '') {
        row[column.id] = null
        continue
      }
      const type = schema.typeOf(column)
      const value = type.parse(raw, column)
      if (value === undefined) {
        issues.push({
          row: rowIndex,
          column: column.id,
          value: raw,
          message: `"${raw}" is not a valid ${type.name}`,
        })
      } else {
        row[column.id] = value
      }
    }
    return row
  })
  return { rows, issues }
}
