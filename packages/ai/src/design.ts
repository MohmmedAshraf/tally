import { generateText, Output, type LanguageModel } from 'ai'
import { columnLabel, type Column, type Schema } from 'tally-core'
import { z } from 'zod'

export interface DesignColumnOptions {
  readonly model: LanguageModel
  readonly schema: Schema
  readonly signal?: AbortSignal | undefined
}

export interface ColumnDesign {
  readonly column: Column
  readonly instruction: string
}

const TONES = {
  green: 'oklch(0.62 0.14 150)',
  blue: 'oklch(0.62 0.13 250)',
  amber: 'oklch(0.7 0.16 60)',
  red: 'oklch(0.6 0.19 25)',
  violet: 'oklch(0.6 0.17 300)',
  gray: 'oklch(0.62 0.01 80)',
} as const

const designSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe('A short snake_case identifier for the column'),
  label: z.string().describe('A short title for the column header'),
  type: z.enum(['text', 'number', 'enum', 'boolean', 'date']),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        tone: z
          .enum(['green', 'blue', 'amber', 'red', 'violet', 'gray'])
          .describe('green for good, amber for caution, red for bad, gray for neutral'),
      }),
    )
    .nullable()
    .describe('The allowed values when the type is enum, otherwise null'),
  instruction: z
    .string()
    .describe('A precise instruction for computing the value of one row from its inputs'),
})

function system(schema: Schema): string {
  const columns = schema.columns
    .filter((column) => column.hidden !== true)
    .map((column) => `- ${column.id} (${column.type}): ${columnLabel(column)}`)
  return [
    'You design a new column for a table. A model will later fill it one row at a time.',
    'Pick the narrowest type that fits. Prefer enum with a few options for categories.',
    `Existing columns:\n${columns.join('\n')}`,
  ].join('\n\n')
}

function uniqueId(id: string, schema: Schema): string {
  let candidate = id
  let suffix = 2
  while (schema.column(candidate) !== undefined) {
    candidate = `${id}_${String(suffix)}`
    suffix += 1
  }
  return candidate
}

export async function designColumn(
  prompt: string,
  options: DesignColumnOptions,
): Promise<ColumnDesign> {
  const { output } = await generateText({
    model: options.model,
    system: system(options.schema),
    prompt,
    output: Output.object({ schema: designSchema }),
    ...(options.signal === undefined ? {} : { abortSignal: options.signal }),
  })
  const column: Column = {
    id: uniqueId(output.id, options.schema),
    label: output.label,
    type: output.type,
    ...(output.type === 'enum' && output.options !== null && output.options.length > 0
      ? {
          options: output.options.map((option) => ({
            value: option.value,
            label: option.label,
            color: TONES[option.tone],
          })),
        }
      : {}),
    ai: true,
    filterable: false,
    sortable: false,
    groupable: false,
    editable: false,
  }
  return { column, instruction: output.instruction }
}
