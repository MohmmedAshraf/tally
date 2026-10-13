import { z } from 'zod'
import { TallyError } from '../errors.ts'
import type { Filter, Group, Sort } from '../query/ast.ts'
import { filterSchema, groupSchema, sortSchema } from '../query/schema.ts'
import type { RowKey } from '../rows/row.ts'
import type { PinSide } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import { AGGREGATES, type AggregateName } from '../types/aggregate.ts'
import { OPERATORS, type Operator } from '../types/operator.ts'

export type Density = 'compact' | 'comfortable' | 'spacious'

export interface ColumnState {
  readonly id: string
  readonly width?: number | undefined
  readonly hidden?: boolean | undefined
  readonly pin?: PinSide | undefined
}

export interface FormatRule {
  readonly id: string
  readonly column: string
  readonly op: Operator
  readonly value?: unknown
  readonly style: FormatStyle
}

export interface FormatStyle {
  readonly color?: string | undefined
  readonly background?: string | undefined
  readonly bold?: boolean | undefined
  readonly italic?: boolean | undefined
  readonly strike?: boolean | undefined
}

export interface View {
  readonly columns: readonly ColumnState[]
  readonly filter?: Filter | undefined
  readonly sort: readonly Sort[]
  readonly group?: Group | undefined
  readonly density: Density
  readonly rules: readonly FormatRule[]
  readonly footer: Readonly<Record<string, AggregateName>>
  readonly pinnedRows: readonly RowKey[]
  readonly expanded: readonly RowKey[]
  readonly collapsedGroups: readonly string[]
}

const rowKeySchema = z.union([z.string(), z.number()])

const columnStateSchema: z.ZodType<ColumnState> = z.strictObject({
  id: z.string().min(1),
  width: z.number().positive().optional(),
  hidden: z.boolean().optional(),
  pin: z.enum(['left', 'right']).optional(),
})

const formatRuleSchema: z.ZodType<FormatRule> = z.strictObject({
  id: z.string().min(1),
  column: z.string().min(1),
  op: z.enum(OPERATORS),
  value: z.unknown().optional(),
  style: z.strictObject({
    color: z.string().optional(),
    background: z.string().optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    strike: z.boolean().optional(),
  }),
})

const viewSchema: z.ZodType<View> = z.strictObject({
  columns: z.array(columnStateSchema).readonly(),
  filter: filterSchema.optional(),
  sort: z.array(sortSchema).readonly(),
  group: groupSchema.optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']),
  rules: z.array(formatRuleSchema).readonly(),
  footer: z.record(z.string(), z.enum(AGGREGATES)).readonly(),
  pinnedRows: z.array(rowKeySchema).readonly(),
  expanded: z.array(rowKeySchema).readonly(),
  collapsedGroups: z.array(z.string()).readonly(),
})

export function defaultView(schema: Schema): View {
  const footer: Record<string, AggregateName> = {}
  for (const column of schema.columns) {
    if (column.aggregate !== undefined) footer[column.id] = column.aggregate
  }
  return {
    columns: schema.columns.map((column) => ({
      id: column.id,
      ...(column.width === undefined ? {} : { width: column.width }),
      ...(column.hidden === true ? { hidden: true } : {}),
      ...(column.pin === undefined ? {} : { pin: column.pin }),
    })),
    sort: [],
    density: 'comfortable',
    rules: [],
    footer,
    pinnedRows: [],
    expanded: [],
    collapsedGroups: [],
  }
}

export function validateView(input: unknown): View {
  const result = viewSchema.safeParse(input)
  if (!result.success) {
    throw new TallyError(
      'invalid_view',
      'View is invalid',
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }
  return result.data
}

export function validateFilter(input: unknown): Filter {
  const result = filterSchema.safeParse(input)
  if (!result.success) {
    throw new TallyError(
      'invalid_filter',
      'Filter is invalid',
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }
  return result.data
}

export function reconcileView(view: View, schema: Schema): View {
  const known = new Set(schema.columns.map((column) => column.id))
  const seen = new Set<string>()
  const columns = view.columns.filter((state) => {
    if (!known.has(state.id) || seen.has(state.id)) return false
    seen.add(state.id)
    return true
  })
  const missing = defaultView(schema).columns.filter((state) => !seen.has(state.id))
  const footer: Record<string, AggregateName> = {}
  for (const [id, fn] of Object.entries(view.footer)) {
    const column = schema.column(id)
    if (column !== undefined && schema.typeOf(column).aggregates.includes(fn)) footer[id] = fn
  }
  return {
    ...view,
    columns: [...columns, ...missing],
    sort: view.sort.filter((sort) => known.has(sort.column)),
    ...(view.group !== undefined && !known.has(view.group.column) ? { group: undefined } : {}),
    rules: view.rules.filter((rule) => known.has(rule.column)),
    footer,
  }
}
