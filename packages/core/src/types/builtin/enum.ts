import type { Column, EnumOption } from '../../schema/column.ts'
import type { ColumnType } from '../column-type.ts'
import { ENUM_OPERATORS, collator, isString, toText } from './shared.ts'

export function findOption(column: Column, text: string): EnumOption | undefined {
  const options = column.options ?? []
  const lower = text.trim().toLowerCase()
  if (lower === '') return undefined
  return (
    options.find((option) => option.value.toLowerCase() === lower) ??
    options.find((option) => option.label?.toLowerCase() === lower) ??
    options.find(
      (option) =>
        option.value.toLowerCase().startsWith(lower) ||
        option.label?.toLowerCase().startsWith(lower) === true,
    ) ??
    options.find((option) =>
      (option.label ?? option.value)
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.startsWith(lower)),
    )
  )
}

export function optionLabel(column: Column, value: string): string {
  const option = column.options?.find((candidate) => candidate.value === value)
  return option?.label ?? value
}

export const enumType: ColumnType<string> = {
  name: 'enum',
  kind: 'enum',
  operators: ENUM_OPERATORS,
  aggregates: ['count', 'distinct'],
  facet: 'terms',
  align: 'start',
  card: 'badge',
  searchable: true,
  groupable: true,
  is: isString,
  parse: (input, column) => {
    const text = toText(input)
    if (text === undefined) return undefined
    return findOption(column, text)?.value
  },
  format: (value, column) => optionLabel(column, value),
  compare: (a, b, column, context) => {
    const options = column.options ?? []
    const indexA = options.findIndex((option) => option.value === a)
    const indexB = options.findIndex((option) => option.value === b)
    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== indexB) return indexA === -1 ? 1 : -1
    return collator(context).compare(a, b)
  },
  jsonSchema: (column) => {
    const values = (column.options ?? []).map((option) => option.value)
    return values.length > 0 ? { type: 'string', enum: values } : { type: 'string' }
  },
}
