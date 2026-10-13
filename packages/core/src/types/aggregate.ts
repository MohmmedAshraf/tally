export const AGGREGATES = ['sum', 'avg', 'min', 'max', 'count', 'distinct'] as const

export type AggregateName = (typeof AGGREGATES)[number]

export function isAggregate(value: unknown): value is AggregateName {
  return typeof value === 'string' && (AGGREGATES as readonly string[]).includes(value)
}
