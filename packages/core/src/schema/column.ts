import { z } from 'zod'
import { TallyError } from '../errors.ts'
import { AGGREGATES, type AggregateName } from '../types/aggregate.ts'

export type CardRole = 'title' | 'badge' | 'metric' | 'meta' | 'hidden'

export type PinSide = 'left' | 'right'

export type Alignment = 'start' | 'end'

export interface EnumOption {
  readonly value: string
  readonly label?: string | undefined
  readonly color?: string | undefined
}

export interface ColumnFormat {
  readonly currency?: string | undefined
  readonly fractionDigits?: number | undefined
  readonly compact?: boolean | undefined
  readonly signed?: boolean | undefined
  readonly prefix?: string | undefined
  readonly suffix?: string | undefined
  readonly dateStyle?: 'short' | 'medium' | 'long' | undefined
  readonly durationUnit?: 'seconds' | 'milliseconds' | 'minutes' | undefined
}

export interface Column {
  readonly id: string
  readonly type: string
  readonly label?: string | undefined
  readonly description?: string | undefined
  readonly aliases?: readonly string[] | undefined
  readonly options?: readonly EnumOption[] | undefined
  readonly format?: ColumnFormat | undefined
  readonly editable?: boolean | undefined
  readonly sortable?: boolean | undefined
  readonly filterable?: boolean | undefined
  readonly groupable?: boolean | undefined
  readonly searchable?: boolean | undefined
  readonly width?: number | undefined
  readonly minWidth?: number | undefined
  readonly maxWidth?: number | undefined
  readonly align?: Alignment | undefined
  readonly wrap?: boolean | undefined
  readonly pin?: PinSide | undefined
  readonly hidden?: boolean | undefined
  readonly group?: string | undefined
  readonly card?: CardRole | undefined
  readonly aggregate?: AggregateName | undefined
  readonly tree?: boolean | undefined
  readonly rollup?: boolean | undefined
}

const identifier = z.string().min(1).max(200)

const enumOptionSchema = z.strictObject({
  value: z.string(),
  label: z.string().optional(),
  color: z.string().optional(),
})

const columnFormatSchema = z.strictObject({
  currency: z.string().length(3).optional(),
  fractionDigits: z.int().min(0).max(20).optional(),
  compact: z.boolean().optional(),
  signed: z.boolean().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  dateStyle: z.enum(['short', 'medium', 'long']).optional(),
  durationUnit: z.enum(['seconds', 'milliseconds', 'minutes']).optional(),
})

export const columnSchema: z.ZodType<Column> = z.strictObject({
  id: identifier,
  type: identifier,
  label: z.string().optional(),
  description: z.string().optional(),
  aliases: z.array(z.string().min(1)).readonly().optional(),
  options: z.array(enumOptionSchema).readonly().optional(),
  format: columnFormatSchema.optional(),
  editable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  groupable: z.boolean().optional(),
  searchable: z.boolean().optional(),
  width: z.number().positive().optional(),
  minWidth: z.number().positive().optional(),
  maxWidth: z.number().positive().optional(),
  align: z.enum(['start', 'end']).optional(),
  wrap: z.boolean().optional(),
  pin: z.enum(['left', 'right']).optional(),
  hidden: z.boolean().optional(),
  group: z.string().optional(),
  card: z.enum(['title', 'badge', 'metric', 'meta', 'hidden']).optional(),
  aggregate: z.enum(AGGREGATES).optional(),
  tree: z.boolean().optional(),
  rollup: z.boolean().optional(),
})

export type ColumnInput = Omit<Column, 'type'> & { readonly type?: string | undefined }

export function validateColumns(input: readonly ColumnInput[]): readonly Column[] {
  const seen = new Set<string>()
  return input.map((candidate, index) => {
    const result = columnSchema.safeParse({ ...candidate, type: candidate.type ?? 'text' })
    if (!result.success) {
      throw new TallyError(
        'invalid_column',
        `Column at index ${index} is invalid`,
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      )
    }
    if (seen.has(result.data.id)) {
      throw new TallyError('invalid_column', `Duplicate column id "${result.data.id}"`)
    }
    seen.add(result.data.id)
    return result.data
  })
}

export function columnLabel(column: Column): string {
  return column.label ?? column.id
}
