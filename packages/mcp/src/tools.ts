import {
  TallyError,
  createDefaultRegistry,
  createSchema,
  parseQuery,
  printQuery,
  type ColumnInput,
  type Query,
  type RowData,
  type Schema,
} from 'tally-core'
import { detectColumnType, importCsv } from 'tally-core/import'
import {
  mutationIssues,
  parseMutationRequest,
  parseQueryRequest,
  queryIssues,
} from 'tally-protocol'

export interface ParsedQuery {
  readonly ok: boolean
  readonly query: Query | undefined
  readonly printed: string | undefined
  readonly errors: readonly { readonly message: string; readonly offset: number }[]
}

export interface ValidatedRequest {
  readonly valid: boolean
  readonly issues: readonly string[]
}

export interface InferredSchema {
  readonly columns: readonly ColumnInput[]
  readonly key: string | undefined
  readonly issues: readonly string[]
}

function detailsOf(error: unknown): readonly string[] {
  if (error instanceof TallyError) return error.details.length > 0 ? error.details : [error.message]
  return [error instanceof Error ? error.message : String(error)]
}

function schemaFrom(columns: readonly ColumnInput[], key?: string): Schema {
  return createSchema({ columns, ...(key === undefined ? {} : { key }) })
}

export function parseQueryText(text: string, columns: readonly ColumnInput[]): ParsedQuery {
  const schema = schemaFrom(columns)
  const result = parseQuery(text, schema)
  const errors = result.errors.map((error) => ({ message: error.message, offset: error.offset }))
  if (errors.length > 0) return { ok: false, query: undefined, printed: undefined, errors }
  return { ok: true, query: result.query, printed: printQuery(result.query, schema), errors }
}

export function validateRequest(
  kind: 'query' | 'mutation',
  request: unknown,
  columns: readonly ColumnInput[],
  key?: string,
): ValidatedRequest {
  try {
    const schema = schemaFrom(columns, key)
    const issues =
      kind === 'query'
        ? queryIssues(parseQueryRequest(request), schema)
        : mutationIssues(parseMutationRequest(request), schema)
    return { valid: issues.length === 0, issues }
  } catch (error) {
    return { valid: false, issues: detailsOf(error) }
  }
}

function sampleOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return ''
}

export function inferFromRows(rows: readonly RowData[], key?: string): InferredSchema {
  const registry = createDefaultRegistry()
  const ids = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const issues: string[] = []
  const columns = ids.flatMap((id): ColumnInput[] => {
    const values = rows.map((row) => row[id])
    if (values.some((value) => typeof value === 'object' && value !== null)) {
      issues.push(
        `${id} holds objects or arrays and was left out; reference it from a column option such as sparkline instead`,
      )
      return []
    }
    const detected = detectColumnType(values.map(sampleOf), registry)
    return [
      {
        id,
        type: detected.type,
        ...(detected.options === undefined ? {} : { options: detected.options }),
      },
    ]
  })
  const keyField = key ?? (ids.includes('id') ? 'id' : undefined)
  return { columns, key: keyField, issues }
}

export function inferFromCsv(text: string, key?: string): InferredSchema {
  const result = importCsv(text, key === undefined ? {} : { keyField: key })
  return {
    columns: result.columns.map((entry) => entry.column),
    key: result.keyField,
    issues: result.issues.map((issue) => `${issue.row}:${issue.column} ${issue.message}`),
  }
}
