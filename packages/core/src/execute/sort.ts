import type { Sort } from '../query/ast.ts'
import type { RowData } from '../rows/row.ts'
import type { Schema } from '../schema/schema.ts'
import { isEmptyValue } from '../types/column-type.ts'
import type { ExecutionContext } from './context.ts'

export type Comparator = (a: RowData, b: RowData) => number

interface KeyedSort {
  key(row: RowData): readonly unknown[]
  compare(x: readonly unknown[], y: readonly unknown[]): number
  rows: Comparator
}

const EMPTY = Symbol('empty')

function keyedSort(
  sorts: readonly Sort[],
  schema: Schema,
  context: ExecutionContext,
): KeyedSort | undefined {
  const steps = sorts.flatMap((sort) => {
    const column = schema.column(sort.column)
    if (column === undefined) return []
    return [{ column, type: schema.typeOf(column), sign: sort.direction === 'asc' ? 1 : -1 }]
  })
  if (steps.length === 0) return undefined
  type Step = (typeof steps)[number]
  const keyOf = (row: RowData, { column, type }: Step): unknown => {
    const value = schema.valueOf(row, column)
    return isEmptyValue(value) || !type.is(value) ? EMPTY : value
  }
  const compareStep = (a: unknown, b: unknown, { column, type, sign }: Step): number => {
    if (a === EMPTY || b === EMPTY) return a === b ? 0 : a === EMPTY ? 1 : -1
    return type.compare(a, b, column, context.format) * sign
  }
  const first = (compare: (step: Step, index: number) => number): number => {
    for (const [index, step] of steps.entries()) {
      const order = compare(step, index)
      if (order !== 0) return order
    }
    return 0
  }
  return {
    key: (row) => steps.map((step) => keyOf(row, step)),
    compare: (x, y) => first((step, index) => compareStep(x[index], y[index], step)),
    rows: (a, b) => first((step) => compareStep(keyOf(a, step), keyOf(b, step), step)),
  }
}

export function compileSort(
  sorts: readonly Sort[],
  schema: Schema,
  context: ExecutionContext,
): Comparator | undefined {
  const keyed = keyedSort(sorts, schema, context)
  return keyed?.rows
}

export function sortRows(
  rows: readonly RowData[],
  sorts: readonly Sort[],
  schema: Schema,
  context: ExecutionContext,
): readonly RowData[] {
  const keyed = keyedSort(sorts, schema, context)
  if (keyed === undefined) return rows
  return rows
    .map((row) => ({ row, key: keyed.key(row) }))
    .toSorted((a, b) => keyed.compare(a.key, b.key))
    .map((entry) => entry.row)
}
