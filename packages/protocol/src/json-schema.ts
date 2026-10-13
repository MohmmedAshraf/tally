import { columnSchema, filterSchema, groupSchema, sortSchema } from 'tally-core'
import { z } from 'zod'
import {
  capabilitiesSchema,
  facetSchema,
  groupSummarySchema,
  mutationRequestSchema,
  mutationResultSchema,
  mutationSchema,
  queryRequestSchema,
  queryResponseSchema,
  rowDataSchema,
  rowPatchSchema,
  schemaResponseSchema,
} from './wire.ts'

export type JsonSchemaDocument = Readonly<Record<string, unknown>>

const registry = z.registry<{ id: string }>()
registry.add(filterSchema, { id: 'Filter' })
registry.add(sortSchema, { id: 'Sort' })
registry.add(groupSchema, { id: 'Group' })
registry.add(columnSchema, { id: 'Column' })
registry.add(rowDataSchema, { id: 'RowData' })
registry.add(groupSummarySchema, { id: 'GroupSummary' })
registry.add(facetSchema, { id: 'Facet' })
registry.add(mutationSchema, { id: 'Mutation' })
registry.add(capabilitiesSchema, { id: 'Capabilities' })

export const JSON_SCHEMA_NAMES = [
  'query-request',
  'query-response',
  'mutation-request',
  'mutation-result',
  'row-patch',
  'schema-response',
] as const

export type JsonSchemaName = (typeof JSON_SCHEMA_NAMES)[number]

const sources: Readonly<Record<JsonSchemaName, z.ZodType>> = {
  'query-request': queryRequestSchema,
  'query-response': queryResponseSchema,
  'mutation-request': mutationRequestSchema,
  'mutation-result': mutationResultSchema,
  'row-patch': rowPatchSchema,
  'schema-response': schemaResponseSchema,
}

export function toJsonSchema(name: JsonSchemaName): JsonSchemaDocument {
  const schema = z.toJSONSchema(sources[name], {
    target: 'draft-2020-12',
    io: 'input',
    metadata: registry,
    override: (context) => {
      delete context.jsonSchema['readOnly']
    },
  })
  return schema
}
