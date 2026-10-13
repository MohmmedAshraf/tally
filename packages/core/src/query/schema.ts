import { z } from 'zod'
import { OPERATORS } from '../types/operator.ts'
import type { Filter, Group, Sort } from './ast.ts'

export const filterSchema: z.ZodType<Filter> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('and'), filters: z.array(filterSchema).readonly() }),
    z.strictObject({ type: z.literal('or'), filters: z.array(filterSchema).readonly() }),
    z.strictObject({ type: z.literal('not'), filter: filterSchema }),
    z.strictObject({
      type: z.literal('condition'),
      column: z.string().min(1),
      op: z.enum(OPERATORS),
      value: z.unknown().optional(),
    }),
    z.strictObject({ type: z.literal('search'), text: z.string() }),
    z.strictObject({ type: z.literal('flag'), name: z.string().min(1) }),
  ]),
)

export const sortSchema: z.ZodType<Sort> = z.strictObject({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
})

export const groupSchema: z.ZodType<Group> = z.strictObject({
  column: z.string().min(1),
  granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
})
