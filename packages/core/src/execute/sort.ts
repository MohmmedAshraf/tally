import type { Sort } from '../query/ast.ts'
import type { RowData } from '../rows/row.ts'
import type { Schema } from '../schema/schema.ts'
import { isEmptyValue } from '../types/column-type.ts'
import type { ExecutionContext } from './context.ts'

export type Comparator = (a: RowData, b: RowData) => number

export function compileSort(
  sorts: readonly Sort[],
  schema: Schema,
  context: ExecutionContext,
): Comparator | undefined {
  const steps = sorts.flatMap((sort) => {
    const column = schema.column(sort.column)
    if (column === undefined) return []
    const type = schema.typeOf(column)
    const sign = sort.direction === 'asc' ? 1 : -1
    return [{ column, type, sign }]
  })
  if (steps.length === 0) return undefined
  return (a, b) => {
    for (const { column, type, sign } of steps) {
      const x = schema.valueOf(a, column)
      const y = schema.valueOf(b, column)
      const emptyX = isEmptyValue(x) || !type.is(x)
      const emptyY = isEmptyValue(y) || !type.is(y)
      if (emptyX || emptyY) {
        if (emptyX && emptyY) continue
        return emptyX ? 1 : -1
      }
      const order = type.compare(x, y, column, context.format)
      if (order !== 0) return order * sign
    }
    return 0
  }
}

export function sortRows(
  rows: readonly RowData[],
  sorts: readonly Sort[],
  schema: Schema,
  context: ExecutionContext,
): readonly RowData[] {
  const comparator = compileSort(sorts, schema, context)
  return comparator === undefined ? rows : rows.toSorted(comparator)
}
