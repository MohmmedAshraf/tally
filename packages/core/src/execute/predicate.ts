import { isRelativeRange, resolveRelativeRange } from '../format/date.ts'
import type { Condition, Filter } from '../query/ast.ts'
import type { RowData } from '../rows/row.ts'
import type { Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import { isEmptyValue, type ColumnType } from '../types/column-type.ts'
import type { ExecutionContext } from './context.ts'

export type Predicate = (row: RowData) => boolean

const ALWAYS: Predicate = () => true
const NEVER: Predicate = () => false

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : String(value)
}

function textOf(value: unknown): string | undefined {
  if (isEmptyValue(value)) return undefined
  return typeof value === 'string' ? value : String(value)
}

function compareWith(
  type: ColumnType,
  column: Column,
  context: ExecutionContext,
  target: unknown,
  accept: (order: number) => boolean,
): (value: unknown) => boolean {
  return (value) => {
    if (isEmptyValue(value) || !type.is(value) || !type.is(target)) return false
    return accept(type.compare(value, target, column, context.format))
  }
}

function equalsFactory(type: ColumnType, column: Column, context: ExecutionContext) {
  return (value: unknown, target: unknown): boolean => {
    if (isEmptyValue(value)) return false
    if (type.kind === 'text') {
      const a = textOf(value)
      const b = textOf(target)
      return a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase()
    }
    if (!type.is(value) || !type.is(target)) return false
    return type.compare(value, target, column, context.format) === 0
  }
}

function conditionPredicate(
  condition: Condition,
  schema: Schema,
  context: ExecutionContext,
): Predicate {
  const column = schema.column(condition.column)
  if (column === undefined) return NEVER
  const type = schema.typeOf(column)
  const read = (row: RowData): unknown => schema.valueOf(row, column)
  const equals = equalsFactory(type, column, context)
  const target = condition.value
  switch (condition.op) {
    case 'eq':
      return (row) => equals(read(row), target)
    case 'neq':
      return (row) => !equals(read(row), target)
    case 'lt': {
      const test = compareWith(type, column, context, target, (order) => order < 0)
      return (row) => test(read(row))
    }
    case 'lte': {
      const test = compareWith(type, column, context, target, (order) => order <= 0)
      return (row) => test(read(row))
    }
    case 'gt': {
      const test = compareWith(type, column, context, target, (order) => order > 0)
      return (row) => test(read(row))
    }
    case 'gte': {
      const test = compareWith(type, column, context, target, (order) => order >= 0)
      return (row) => test(read(row))
    }
    case 'between': {
      const pair: readonly unknown[] = Array.isArray(target) ? target : []
      const low = compareWith(type, column, context, pair[0], (order) => order >= 0)
      const high = compareWith(type, column, context, pair[1], (order) => order <= 0)
      return (row) => {
        const value = read(row)
        return low(value) && high(value)
      }
    }
    case 'within': {
      if (!isRelativeRange(target)) return NEVER
      const range = resolveRelativeRange(target, context.today)
      const low = compareWith(type, column, context, range.start, (order) => order >= 0)
      const high = compareWith(type, column, context, range.end, (order) => order <= 0)
      return (row) => {
        const value = read(row)
        return low(value) && high(value)
      }
    }
    case 'contains': {
      const needle = lower(target)
      return (row) => {
        const text = textOf(read(row))
        return text !== undefined && text.toLowerCase().includes(needle)
      }
    }
    case 'notContains': {
      const needle = lower(target)
      return (row) => {
        const text = textOf(read(row))
        return text === undefined || !text.toLowerCase().includes(needle)
      }
    }
    case 'startsWith': {
      const needle = lower(target)
      return (row) => {
        const text = textOf(read(row))
        return text !== undefined && text.toLowerCase().startsWith(needle)
      }
    }
    case 'endsWith': {
      const needle = lower(target)
      return (row) => {
        const text = textOf(read(row))
        return text !== undefined && text.toLowerCase().endsWith(needle)
      }
    }
    case 'in':
    case 'notIn': {
      const values: readonly unknown[] = Array.isArray(target) ? target : [target]
      const member = (row: RowData): boolean => {
        const value = read(row)
        return values.some((candidate) => equals(value, candidate))
      }
      return condition.op === 'in' ? member : (row) => !member(row)
    }
    case 'empty':
      return (row) => isEmptyValue(read(row))
    case 'notEmpty':
      return (row) => !isEmptyValue(read(row))
  }
}

export function searchPredicate(
  text: string,
  schema: Schema,
  context: ExecutionContext,
): Predicate {
  const needle = text.trim().toLowerCase()
  if (needle === '') return ALWAYS
  const targets = schema.columns
    .filter((column) => column.searchable ?? schema.typeOf(column).searchable)
    .map((column) => ({ column, type: schema.typeOf(column) }))
  return (row) =>
    targets.some(({ column, type }) => {
      const value = schema.valueOf(row, column)
      if (isEmptyValue(value)) return false
      const haystack = type.is(value) ? type.format(value, column, context.format) : String(value)
      return haystack.toLowerCase().includes(needle)
    })
}

export function compileFilter(
  filter: Filter | undefined,
  schema: Schema,
  context: ExecutionContext,
): Predicate {
  if (filter === undefined) return ALWAYS
  switch (filter.type) {
    case 'condition':
      return conditionPredicate(filter, schema, context)
    case 'search':
      return searchPredicate(filter.text, schema, context)
    case 'flag':
      return (row) => context.flags(filter.name, row)
    case 'not': {
      const inner = compileFilter(filter.filter, schema, context)
      return (row) => !inner(row)
    }
    case 'and': {
      const parts = filter.filters.map((child) => compileFilter(child, schema, context))
      return (row) => parts.every((part) => part(row))
    }
    case 'or': {
      const parts = filter.filters.map((child) => compileFilter(child, schema, context))
      return (row) => parts.some((part) => part(row))
    }
  }
}
