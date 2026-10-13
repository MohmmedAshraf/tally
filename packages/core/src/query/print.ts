import type { RelativeRange } from '../format/date.ts'
import type { Schema } from '../schema/schema.ts'
import type { Operator } from '../types/operator.ts'
import type { Filter, Query, Sort } from './ast.ts'
import { isKeyword } from './lexer.ts'

const SAFE_WORD = /^[\p{L}\p{N}_#@][\p{L}\p{N}_\-'’.#@/]*$/u

function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function needsQuotes(text: string, schema: Schema): boolean {
  if (text === '' || !SAFE_WORD.test(text)) return true
  if (isKeyword(text)) return true
  return schema.resolve(text) !== undefined
}

function printValue(value: unknown, schema: Schema): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return needsQuotes(value, schema) ? quote(value) : value
  if (value === null || value === undefined) return '""'
  return quote(JSON.stringify(value))
}

const UNIT_WORDS: Readonly<Record<RelativeRange['unit'], [string, string]>> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  quarter: ['quarter', 'quarters'],
  year: ['year', 'years'],
}

export function printRelative(range: RelativeRange): string {
  if (range.direction === 'this') {
    if (range.unit === 'day') {
      if (range.shift === -1) return 'yesterday'
      if (range.shift === 1) return 'tomorrow'
      if (range.shift === undefined || range.shift === 0) return 'today'
    }
    return `this ${UNIT_WORDS[range.unit][0]}`
  }
  const [singular, plural] = UNIT_WORDS[range.unit]
  return `${range.direction} ${range.amount} ${range.amount === 1 ? singular : plural}`
}

const OPERATOR_WORDS: Readonly<Record<Operator, string>> = {
  eq: 'is',
  neq: 'is not',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  between: 'between',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  in: 'in',
  notIn: 'not in',
  empty: 'is empty',
  notEmpty: 'is not empty',
  within: 'in',
}

function isRelative(value: unknown): value is RelativeRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'direction' in value &&
    'unit' in value &&
    'amount' in value
  )
}

function printCondition(column: string, op: Operator, value: unknown, schema: Schema): string {
  const word = OPERATOR_WORDS[op]
  switch (op) {
    case 'empty':
    case 'notEmpty':
      return `${column} ${word}`
    case 'between': {
      const [low, high] = Array.isArray(value) ? value : [value, value]
      return `${column} between ${printValue(low, schema)} and ${printValue(high, schema)}`
    }
    case 'in':
    case 'notIn': {
      const values = Array.isArray(value) ? value : [value]
      return `${column} ${word} (${values.map((item) => printValue(item, schema)).join(', ')})`
    }
    case 'within':
      return isRelative(value)
        ? `${column} in ${printRelative(value)}`
        : `${column} in ${printValue(value, schema)}`
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
    case 'contains':
    case 'notContains':
    case 'startsWith':
    case 'endsWith':
      return `${column} ${word} ${printValue(value, schema)}`
  }
}

function printColumn(id: string, schema: Schema): string {
  return schema.column(id) === undefined ? quote(id) : id
}

function printNode(filter: Filter, schema: Schema, parent: Filter['type'] | undefined): string {
  switch (filter.type) {
    case 'condition':
      return printCondition(printColumn(filter.column, schema), filter.op, filter.value, schema)
    case 'search':
      return needsQuotes(filter.text, schema) ? quote(filter.text) : filter.text
    case 'flag':
      return `is:${filter.name}`
    case 'not':
      return `not ${printNode(filter.filter, schema, 'not')}`
    case 'and': {
      const text = filter.filters.map((child) => printNode(child, schema, 'and')).join(' and ')
      return parent === 'not' ? `(${text})` : text
    }
    case 'or': {
      const text = filter.filters.map((child) => printNode(child, schema, 'or')).join(' or ')
      return parent === undefined ? text : `(${text})`
    }
  }
}

export function printFilter(filter: Filter | undefined, schema: Schema): string {
  return filter === undefined ? '' : printNode(filter, schema, undefined)
}

export function printSort(sort: Sort, schema: Schema): string {
  return `sort by ${printColumn(sort.column, schema)} ${sort.direction}`
}

export function printQuery(query: Query, schema: Schema): string {
  const parts = [printFilter(query.filter, schema)]
  for (const sort of query.sort) parts.push(printSort(sort, schema))
  if (query.group !== undefined) parts.push(`group by ${printColumn(query.group.column, schema)}`)
  return parts.filter((part) => part !== '').join(', ')
}
