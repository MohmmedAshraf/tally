import {
  OPERATOR_ARITY,
  TallyError,
  isEmptyValue,
  type Column,
  type ColumnType,
  type Condition,
  type Filter,
  type Mutation,
  type Operator,
  type QueryRequest,
  type RowData,
  type Schema,
} from 'tally-core'
import type { z } from 'zod'
import {
  mutationRequestSchema,
  queryRequestSchema,
  relativeRangeSchema,
  type MutationRequest,
} from './wire.ts'

const TEXT_OPERATORS: ReadonlySet<Operator> = new Set([
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
])

function issuesOf(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

function parse<T>(schema: z.ZodType<T>, input: unknown, subject: string): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw new TallyError('invalid_query', `${subject} is invalid`, issuesOf(result.error))
}

export function parseQueryRequest(input: unknown): QueryRequest {
  return parse(queryRequestSchema, input, 'Query request')
}

export function parseMutationRequest(input: unknown): MutationRequest {
  return parse(mutationRequestSchema, input, 'Mutation request')
}

function accepts(type: ColumnType, op: Operator, value: unknown): boolean {
  if (TEXT_OPERATORS.has(op)) return typeof value === 'string'
  if (type.kind === 'text') {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  }
  return type.is(value)
}

function conditionIssues(condition: Condition, schema: Schema, path: string): readonly string[] {
  const column = schema.column(condition.column)
  if (column === undefined) return [`${path}.column: unknown column "${condition.column}"`]
  if (column.filterable === false) {
    return [`${path}.column: column "${condition.column}" is not filterable`]
  }
  const type = schema.typeOf(column)
  if (!type.operators.includes(condition.op)) {
    return [`${path}.op: operator "${condition.op}" is not supported by type "${type.name}"`]
  }
  const value = condition.value
  switch (OPERATOR_ARITY[condition.op]) {
    case 'none':
      return value === undefined ? [] : [`${path}.value: operator "${condition.op}" takes no value`]
    case 'one':
      return accepts(type, condition.op, value)
        ? []
        : [`${path}.value: expected a ${type.kind} value for "${condition.column}"`]
    case 'two':
      return Array.isArray(value) &&
        value.length === 2 &&
        value.every((entry) => accepts(type, condition.op, entry))
        ? []
        : [`${path}.value: expected two ${type.kind} values for "${condition.column}"`]
    case 'many':
      return Array.isArray(value) &&
        value.length > 0 &&
        value.every((entry) => accepts(type, condition.op, entry))
        ? []
        : [`${path}.value: expected a list of ${type.kind} values for "${condition.column}"`]
    case 'relative':
      return relativeRangeSchema.safeParse(value).success
        ? []
        : [`${path}.value: expected a relative range for "${condition.column}"`]
  }
}

function filterIssues(filter: Filter, schema: Schema, path: string): readonly string[] {
  switch (filter.type) {
    case 'condition':
      return conditionIssues(filter, schema, path)
    case 'and':
    case 'or':
      return filter.filters.flatMap((child, index) =>
        filterIssues(child, schema, `${path}.filters.${index}`),
      )
    case 'not':
      return filterIssues(filter.filter, schema, `${path}.filter`)
    case 'search':
    case 'flag':
      return []
  }
}

function groupable(column: Column, type: ColumnType): boolean {
  return column.groupable ?? type.groupable
}

export function queryIssues(request: QueryRequest, schema: Schema): readonly string[] {
  const issues: string[] = []
  if (request.filter !== undefined) issues.push(...filterIssues(request.filter, schema, 'filter'))
  request.sort.forEach((sort, index) => {
    const column = schema.column(sort.column)
    if (column === undefined) issues.push(`sort.${index}.column: unknown column "${sort.column}"`)
    else if (column.sortable === false) {
      issues.push(`sort.${index}.column: column "${sort.column}" is not sortable`)
    }
  })
  if (request.group !== undefined) {
    const column = schema.column(request.group.column)
    if (column === undefined) issues.push(`group.column: unknown column "${request.group.column}"`)
    else {
      const type = schema.typeOf(column)
      if (!groupable(column, type)) {
        issues.push(`group.column: column "${request.group.column}" is not groupable`)
      }
      if (request.group.granularity !== undefined && type.kind !== 'date') {
        issues.push(`group.granularity: only date columns accept a granularity`)
      }
    }
  }
  request.aggregates?.forEach((aggregate, index) => {
    const column = schema.column(aggregate.column)
    if (column === undefined) {
      issues.push(`aggregates.${index}.column: unknown column "${aggregate.column}"`)
    } else if (!schema.typeOf(column).aggregates.includes(aggregate.fn)) {
      issues.push(
        `aggregates.${index}.fn: aggregate "${aggregate.fn}" is not supported by "${aggregate.column}"`,
      )
    }
  })
  request.facets?.forEach((id, index) => {
    const column = schema.column(id)
    if (column === undefined) issues.push(`facets.${index}: unknown column "${id}"`)
    else if (schema.typeOf(column).facet === 'none') {
      issues.push(`facets.${index}: column "${id}" has no facet`)
    }
  })
  return issues
}

function keyIssue(row: RowData, schema: Schema, path: string): readonly string[] {
  try {
    schema.keyOf(row)
    return []
  } catch (error) {
    return [`${path}: ${error instanceof Error ? error.message : 'row has no key'}`]
  }
}

function mutationIssuesOf(mutation: Mutation, schema: Schema, path: string): readonly string[] {
  const issues: string[] = []
  mutation.changes.forEach((change, index) => {
    const column = schema.column(change.column)
    const at = `${path}.changes.${index}`
    if (column === undefined) {
      issues.push(`${at}.column: unknown column "${change.column}"`)
      return
    }
    if (column.editable === false) {
      issues.push(`${at}.column: column "${change.column}" is not editable`)
      return
    }
    if (!isEmptyValue(change.to) && !schema.typeOf(column).is(change.to)) {
      issues.push(`${at}.to: expected a ${schema.typeOf(column).kind} value`)
    }
  })
  mutation.inserted.forEach((insert, index) => {
    issues.push(...keyIssue(insert.row, schema, `${path}.inserted.${index}.row`))
  })
  mutation.deleted.forEach((removal, index) => {
    issues.push(...keyIssue(removal.row, schema, `${path}.deleted.${index}.row`))
  })
  return issues
}

export function mutationIssues(request: MutationRequest, schema: Schema): readonly string[] {
  return request.mutations.flatMap((mutation, index) =>
    mutationIssuesOf(mutation, schema, `mutations.${index}`),
  )
}

function ensure<T>(value: T, issues: readonly string[], subject: string): T {
  if (issues.length > 0) throw new TallyError('invalid_query', `${subject} is invalid`, issues)
  return value
}

export function validateQueryRequest(input: unknown, schema: Schema): QueryRequest {
  const request = parseQueryRequest(input)
  return ensure(request, queryIssues(request, schema), 'Query request')
}

export function validateMutationRequest(input: unknown, schema: Schema): MutationRequest {
  const request = parseMutationRequest(input)
  return ensure(request, mutationIssues(request, schema), 'Mutation request')
}
