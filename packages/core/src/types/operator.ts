export const OPERATORS = [
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'in',
  'notIn',
  'empty',
  'notEmpty',
  'within',
] as const

export type Operator = (typeof OPERATORS)[number]

export type OperatorArity = 'none' | 'one' | 'two' | 'many' | 'relative'

export const OPERATOR_ARITY: Readonly<Record<Operator, OperatorArity>> = {
  eq: 'one',
  neq: 'one',
  lt: 'one',
  lte: 'one',
  gt: 'one',
  gte: 'one',
  between: 'two',
  contains: 'one',
  notContains: 'one',
  startsWith: 'one',
  endsWith: 'one',
  in: 'many',
  notIn: 'many',
  empty: 'none',
  notEmpty: 'none',
  within: 'relative',
}

export const NEGATED_OPERATOR: Readonly<Partial<Record<Operator, Operator>>> = {
  eq: 'neq',
  neq: 'eq',
  contains: 'notContains',
  notContains: 'contains',
  in: 'notIn',
  notIn: 'in',
  empty: 'notEmpty',
  notEmpty: 'empty',
  lt: 'gte',
  gte: 'lt',
  gt: 'lte',
  lte: 'gt',
}

export function isOperator(value: unknown): value is Operator {
  return typeof value === 'string' && (OPERATORS as readonly string[]).includes(value)
}
