import Papa from 'papaparse'
import type { RowData } from '../rows/row.ts'
import type { Column } from '../schema/column.ts'
import { createDefaultRegistry } from '../types/builtin/index.ts'
import type { TypeRegistry } from '../types/registry.ts'
import { detectColumnType, type DetectOptions, type Detection } from './detect.ts'

export interface ImportIssue {
  readonly row: number
  readonly column: string
  readonly value: string
  readonly message: string
}

export interface ImportOptions extends DetectOptions {
  readonly registry?: TypeRegistry | undefined
  readonly types?: Readonly<Record<string, string>> | undefined
  readonly keyField?: string | undefined
  readonly delimiter?: string | undefined
}

export interface ImportedColumn {
  readonly column: Column
  readonly detected: Detection
  readonly samples: readonly string[]
  readonly invalid: number
}

export interface ImportResult {
  readonly columns: readonly ImportedColumn[]
  readonly rows: readonly RowData[]
  readonly issues: readonly ImportIssue[]
  readonly keyField: string
  readonly delimiter: string
}

export function slugifyHeader(header: string, index: number): string {
  const slug = header
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return slug === '' ? `column_${index + 1}` : slug
}

function uniqueIds(headers: readonly string[]): readonly string[] {
  const seen = new Map<string, number>()
  return headers.map((header, index) => {
    const base = slugifyHeader(header, index)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}_${count + 1}`
  })
}

function cell(record: readonly string[], index: number): string {
  return (record[index] ?? '').trim()
}

export function importCsv(text: string, options: ImportOptions = {}): ImportResult {
  const registry = options.registry ?? createDefaultRegistry()
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    ...(options.delimiter === undefined ? {} : { delimiter: options.delimiter }),
  })
  const [header = [], ...records] = parsed.data
  const ids = uniqueIds(header)
  const columns: ImportedColumn[] = ids.map((id, index) => {
    const values = records.map((record) => cell(record, index))
    const detected = detectColumnType(values, registry, options)
    const typeName = options.types?.[id] ?? detected.type
    const type = registry.get(typeName)
    const nonEmpty = values.filter((value) => value !== '')
    const column: Column = {
      id,
      type: type.name,
      label: header[index]?.trim() === '' ? id : header[index]?.trim(),
      editable: true,
      ...(type.kind === 'enum'
        ? { options: [...new Set(nonEmpty)].toSorted().map((value) => ({ value })) }
        : {}),
    }
    return {
      column,
      detected,
      samples: nonEmpty.slice(0, 3),
      invalid: nonEmpty.filter((value) => type.parse(value, column) === undefined).length,
    }
  })
  const issues: ImportIssue[] = []
  const requestedKey = options.keyField ?? 'id'
  const keyIndex = ids.indexOf(requestedKey)
  const keyValues = keyIndex === -1 ? [] : records.map((record) => cell(record, keyIndex))
  const keyIsUsable =
    keyIndex !== -1 &&
    new Set(keyValues).size === keyValues.length &&
    keyValues.every((value) => value !== '')
  const keyField = keyIsUsable
    ? requestedKey
    : requestedKey === 'id' && keyIndex === -1
      ? 'id'
      : '_key'
  const rows = records.map((record, rowIndex) => {
    const row: Record<string, unknown> = {}
    for (const [index, imported] of columns.entries()) {
      const raw = cell(record, index)
      const type = registry.get(imported.column.type)
      if (raw === '') {
        row[imported.column.id] = null
        continue
      }
      const value = type.parse(raw, imported.column)
      if (value === undefined) {
        issues.push({
          row: rowIndex,
          column: imported.column.id,
          value: raw,
          message: `"${raw}" is not a valid ${type.name}`,
        })
        row[imported.column.id] = raw
      } else {
        row[imported.column.id] = value
      }
    }
    if (!keyIsUsable) row[keyField] = rowIndex + 1
    return row
  })
  return { columns, rows, issues, keyField, delimiter: parsed.meta.delimiter }
}
