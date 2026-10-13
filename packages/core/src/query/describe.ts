import type { FormatContext } from '../format/context.ts'
import { isRelativeRange } from '../format/date.ts'
import { columnLabel } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import type { Operator } from '../types/operator.ts'
import type { Filter } from './ast.ts'
import { printFilter, printRelative } from './print.ts'

export interface ClauseDescription {
  readonly column: string | undefined
  readonly operator: string | undefined
  readonly value: string | undefined
  readonly text: string
}

export const OPERATOR_WORDS: Readonly<Record<Operator, string>> = {
  eq: 'is',
  neq: 'is not',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  between: 'between',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  in: 'is',
  notIn: 'is not',
  empty: 'is empty',
  notEmpty: 'is not empty',
  within: 'in',
}

export function topLevelClauses(filter: Filter | undefined): readonly Filter[] {
  if (filter === undefined) return []
  return filter.type === 'and' ? filter.filters : [filter]
}

function formatValue(
  value: unknown,
  columnId: string,
  schema: Schema,
  format: FormatContext,
): string {
  const column = schema.column(columnId)
  if (column === undefined) return String(value)
  const type = schema.typeOf(column)
  if (Array.isArray(value)) {
    return value.map((entry) => formatValue(entry, columnId, schema, format)).join(', ')
  }
  if (isRelativeRange(value)) return printRelative(value)
  return type.is(value) ? type.format(value, column, format) : String(value)
}

export function describeFilter(
  filter: Filter,
  schema: Schema,
  format: FormatContext,
): ClauseDescription {
  const text = printFilter(filter, schema)
  if (filter.type !== 'condition') {
    return { column: undefined, operator: undefined, value: undefined, text }
  }
  const column = schema.column(filter.column)
  const label = column === undefined ? filter.column : columnLabel(column)
  const operator = OPERATOR_WORDS[filter.op]
  if (filter.op === 'empty' || filter.op === 'notEmpty') {
    return { column: label, operator, value: undefined, text }
  }
  if (filter.op === 'between' && Array.isArray(filter.value)) {
    const [from, to] = filter.value as readonly unknown[]
    return {
      column: label,
      operator,
      value: `${formatValue(from, filter.column, schema, format)} – ${formatValue(to, filter.column, schema, format)}`,
      text,
    }
  }
  return {
    column: label,
    operator,
    value: formatValue(filter.value, filter.column, schema, format),
    text,
  }
}
