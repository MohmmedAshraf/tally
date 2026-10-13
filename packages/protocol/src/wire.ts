import {
  AGGREGATES,
  columnSchema,
  filterSchema,
  groupSchema,
  sortSchema,
  type AggregateRequest,
  type Capabilities,
  type Column,
  type CursorPage,
  type Facet,
  type GroupSummary,
  type Mutation,
  type MutationResult,
  type OffsetPage,
  type QueryRequest,
  type QueryResponse,
  type RelativeRange,
  type RowData,
  type RowKey,
  type RowPatch,
} from 'tally-core'
import { z } from 'zod'

export interface MutationRequest {
  readonly version: 1
  readonly mutations: readonly Mutation[]
}

export interface SchemaResponse {
  readonly version: 1
  readonly columns: readonly Column[]
  readonly capabilities: Capabilities
  readonly key?: string | undefined
}

export const rowKeySchema: z.ZodType<RowKey> = z.union([z.string(), z.number()])

export const rowDataSchema: z.ZodType<RowData> = z.record(z.string(), z.unknown()).readonly()

export const relativeRangeSchema: z.ZodType<RelativeRange> = z.strictObject({
  direction: z.enum(['last', 'next', 'this']),
  amount: z.int().min(0),
  unit: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  shift: z.int().optional(),
})

export const offsetPageSchema: z.ZodType<OffsetPage> = z.strictObject({
  offset: z.int().min(0),
  limit: z.int().min(1),
})

export const cursorPageSchema: z.ZodType<CursorPage> = z.strictObject({
  cursor: z.string().optional(),
  limit: z.int().min(1),
})

export const aggregateRequestSchema: z.ZodType<AggregateRequest> = z.strictObject({
  column: z.string().min(1),
  fn: z.enum(AGGREGATES),
})

export const queryRequestSchema: z.ZodType<QueryRequest> = z.strictObject({
  version: z.literal(1),
  filter: filterSchema.optional(),
  sort: z.array(sortSchema).readonly(),
  group: groupSchema.optional(),
  page: z.union([offsetPageSchema, cursorPageSchema]).optional(),
  aggregates: z.array(aggregateRequestSchema).readonly().optional(),
  facets: z.array(z.string().min(1)).readonly().optional(),
})

const aggregateResultsSchema = z.record(z.string(), z.unknown()).readonly()

export const groupSummarySchema: z.ZodType<GroupSummary> = z.strictObject({
  key: z.string(),
  value: z.unknown(),
  count: z.int().min(0),
  aggregates: aggregateResultsSchema,
})

export const facetSchema: z.ZodType<Facet> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('histogram'),
    min: z.unknown(),
    max: z.unknown(),
    bins: z
      .array(z.strictObject({ start: z.unknown(), end: z.unknown(), count: z.int().min(0) }))
      .readonly(),
  }),
  z.strictObject({
    kind: z.literal('terms'),
    terms: z.array(z.strictObject({ value: z.unknown(), count: z.int().min(0) })).readonly(),
    distinct: z.int().min(0),
  }),
])

export const queryResponseSchema: z.ZodType<QueryResponse> = z.strictObject({
  rows: z.array(rowDataSchema).readonly(),
  total: z.int().min(0).optional(),
  matched: z.int().min(0).optional(),
  cursor: z.string().optional(),
  groups: z.array(groupSummarySchema).readonly().optional(),
  aggregates: aggregateResultsSchema.optional(),
  facets: z.record(z.string(), facetSchema).readonly().optional(),
})

export const mutationSchema: z.ZodType<Mutation> = z.strictObject({
  id: z.string().min(1),
  label: z.string(),
  at: z.number(),
  changes: z
    .array(
      z.strictObject({
        key: rowKeySchema,
        column: z.string().min(1),
        from: z.unknown(),
        to: z.unknown(),
      }),
    )
    .readonly(),
  inserted: z
    .array(z.strictObject({ row: rowDataSchema, index: z.int().min(0).optional() }))
    .readonly(),
  deleted: z.array(z.strictObject({ row: rowDataSchema, index: z.int().min(0) })).readonly(),
})

export const mutationRequestSchema: z.ZodType<MutationRequest> = z.strictObject({
  version: z.literal(1),
  mutations: z.array(mutationSchema).readonly(),
})

export const mutationResultSchema: z.ZodType<MutationResult> = z.strictObject({
  accepted: z.boolean(),
  rows: z.array(rowDataSchema).readonly().optional(),
  errors: z
    .array(
      z.strictObject({
        key: rowKeySchema.optional(),
        column: z.string().optional(),
        message: z.string(),
      }),
    )
    .readonly()
    .optional(),
})

export const rowPatchSchema: z.ZodType<RowPatch> = z.strictObject({
  upserts: z.array(rowDataSchema).readonly().optional(),
  deletes: z.array(rowKeySchema).readonly().optional(),
})

export const capabilitiesSchema: z.ZodType<Capabilities> = z.strictObject({
  filter: z.boolean(),
  sort: z.boolean(),
  group: z.boolean(),
  search: z.boolean(),
  aggregates: z.boolean(),
  facets: z.boolean(),
  pagination: z.enum(['none', 'offset', 'cursor']),
  mutate: z.boolean(),
  live: z.boolean(),
})

export const schemaResponseSchema: z.ZodType<SchemaResponse> = z.strictObject({
  version: z.literal(1),
  columns: z.array(columnSchema).readonly(),
  capabilities: capabilitiesSchema,
  key: z.string().optional(),
})
