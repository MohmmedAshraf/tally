import type { FormatContext } from '../../format/context.ts'
import type { Operator } from '../operator.ts'

export const TEXT_OPERATORS: readonly Operator[] = [
  'eq',
  'neq',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'in',
  'notIn',
  'empty',
  'notEmpty',
]

export const NUMBER_OPERATORS: readonly Operator[] = [
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'in',
  'notIn',
  'empty',
  'notEmpty',
]

export const DATE_OPERATORS: readonly Operator[] = [
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'within',
  'empty',
  'notEmpty',
]

export const ENUM_OPERATORS: readonly Operator[] = ['eq', 'neq', 'in', 'notIn', 'empty', 'notEmpty']

export const BOOLEAN_OPERATORS: readonly Operator[] = ['eq', 'neq', 'empty', 'notEmpty']

const collators = new Map<string, Intl.Collator>()

export function collator(context: FormatContext): Intl.Collator {
  let instance = collators.get(context.locale)
  if (instance === undefined) {
    instance = new Intl.Collator(context.locale, { numeric: true, sensitivity: 'base' })
    collators.set(context.locale, instance)
  }
  return instance
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function toText(input: unknown): string | undefined {
  if (typeof input === 'string') return input.trim()
  if (typeof input === 'number' || typeof input === 'bigint') return String(input)
  if (typeof input === 'boolean') return input ? 'true' : 'false'
  return undefined
}

export function compareNumbers(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}
