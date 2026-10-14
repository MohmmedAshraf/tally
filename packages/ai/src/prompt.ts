import {
  OPERATOR_WORDS,
  columnLabel,
  defaultFormatContext,
  type Column,
  type FormatContext,
  type Schema,
} from 'tally-core'

export interface PromptOptions {
  readonly context?: FormatContext | undefined
  readonly examples?: readonly string[] | undefined
  readonly now?: Date | undefined
}

const LANGUAGE = `Write the answer in Tally query text.

Grammar:
- A condition is "<column> <operator> <value>". Join conditions with "and", "or" and "not (...)"; parentheses group.
- Several conditions separated by commas are combined with "and".
- "<column> is a or b" and "<column> in (a, b)" match any of the values.
- "<column> between <low> and <high>" is inclusive.
- "<column> is empty" and "<column> is not empty" test for missing values.
- Bare words outside a condition search every searchable column.
- "sort by <column> asc|desc" sorts; separate several sorts with commas.
- "group by <column>" groups.
- Numbers accept 2k, 1.5m, $5,000 and 12%. Dates accept 2026, 2026-01, 2026-01-15, today, yesterday, last 7 days, next 2 weeks and this quarter.
- Quote values that contain spaces with double quotes.
- Refer to columns by the ids listed below. Use enum values, not their labels.
- Only use operators listed for the column. Only sort or group by columns that allow it.`

function isoDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function operatorWords(schema: Schema, column: Column): string {
  const words = new Set(schema.typeOf(column).operators.map((operator) => OPERATOR_WORDS[operator]))
  return [...words].join(', ')
}

function describeColumn(schema: Schema, column: Column): string {
  const label = columnLabel(column)
  const lines = [`- ${column.id} (${column.type})${label === column.id ? '' : `: ${label}`}`]
  if (column.description !== undefined) lines.push(`  ${column.description}`)
  if (column.aliases !== undefined && column.aliases.length > 0) {
    lines.push(`  also called: ${column.aliases.join(', ')}`)
  }
  if (column.options !== undefined && column.options.length > 0) {
    const values = column.options.map((option) =>
      option.label === undefined || option.label === option.value
        ? option.value
        : `${option.value} (${option.label})`,
    )
    lines.push(`  values: ${values.join(', ')}`)
  }
  if (column.filterable === false) {
    lines.push('  not filterable')
  } else {
    lines.push(`  operators: ${operatorWords(schema, column)}`)
  }
  const limits = [
    column.sortable === false ? 'cannot sort' : undefined,
    column.groupable === false || !schema.typeOf(column).groupable ? 'cannot group' : undefined,
  ].filter((entry) => entry !== undefined)
  if (limits.length > 0) lines.push(`  ${limits.join(', ')}`)
  return lines.join('\n')
}

export function describeSchema(schema: Schema, options: PromptOptions = {}): string {
  const context = options.context ?? defaultFormatContext
  const columns = schema.columns.filter((column) => column.hidden !== true)
  const sections = [
    LANGUAGE,
    `Columns:\n${columns.map((column) => describeColumn(schema, column)).join('\n')}`,
  ]
  if (options.examples !== undefined && options.examples.length > 0) {
    sections.push(`Examples:\n${options.examples.map((example) => `- ${example}`).join('\n')}`)
  }
  sections.push(`Today is ${isoDate(options.now ?? new Date(), context.timeZone)}.`)
  return sections.join('\n\n')
}
