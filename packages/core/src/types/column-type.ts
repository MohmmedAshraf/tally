import type { FormatContext } from '../format/context.ts'
import type { Alignment, CardRole, Column } from '../schema/column.ts'
import type { AggregateName } from './aggregate.ts'
import type { Operator } from './operator.ts'

export type ValueKind = 'text' | 'number' | 'date' | 'boolean' | 'enum'

export type FacetKind = 'histogram' | 'terms' | 'none'

export interface JsonSchema {
  readonly [key: string]: unknown
}

export interface ColumnType<T = unknown> {
  readonly name: string
  readonly kind: ValueKind
  readonly operators: readonly Operator[]
  readonly aggregates: readonly AggregateName[]
  readonly facet: FacetKind
  readonly align: Alignment
  readonly card: CardRole
  readonly searchable: boolean
  readonly groupable: boolean
  is(value: unknown): value is T
  parse(input: unknown, column: Column): T | undefined
  format(value: T, column: Column, context: FormatContext): string
  compare(a: T, b: T, column: Column, context: FormatContext): number
  detect?(sample: string): boolean
  jsonSchema(column: Column): JsonSchema
}

export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}
