import type { Column } from '../../schema/column.ts'
import type { ColumnType } from '../column-type.ts'
import { TEXT_OPERATORS, collator, isString, toText } from './shared.ts'

interface TextTypeOptions {
  readonly name: string
  readonly card: ColumnType['card']
  readonly format?: string | undefined
  readonly detect?: ((sample: string) => boolean) | undefined
  readonly groupable?: boolean | undefined
}

function createTextType(options: TextTypeOptions): ColumnType<string> {
  const type: ColumnType<string> = {
    name: options.name,
    kind: 'text',
    operators: TEXT_OPERATORS,
    aggregates: ['count', 'distinct'],
    facet: options.groupable === true ? 'terms' : 'none',
    align: 'start',
    card: options.card,
    searchable: true,
    groupable: options.groupable ?? false,
    is: isString,
    parse: (input) => {
      const text = toText(input)
      return text === undefined || text === '' ? undefined : text
    },
    format: (value) => value,
    compare: (a, b, _column, context) => collator(context).compare(a, b),
    jsonSchema: () =>
      options.format === undefined
        ? { type: 'string' }
        : { type: 'string', format: options.format },
  }
  if (options.detect !== undefined) return { ...type, detect: options.detect }
  return type
}

export const textType: ColumnType<string> = createTextType({ name: 'text', card: 'title' })

export const emailType: ColumnType<string> = createTextType({
  name: 'email',
  card: 'meta',
  format: 'email',
  detect: (sample) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(sample),
})

export const urlType: ColumnType<string> = createTextType({
  name: 'url',
  card: 'meta',
  format: 'uri',
  detect: (sample) => /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(sample),
})

export const idType: ColumnType<string> = {
  ...createTextType({ name: 'id', card: 'meta' }),
  align: 'start',
  groupable: false,
}

function matchOption(column: Column, text: string): string | undefined {
  const options = column.options ?? []
  const lower = text.toLowerCase()
  const exact = options.find(
    (option) => option.value.toLowerCase() === lower || option.label?.toLowerCase() === lower,
  )
  if (exact !== undefined) return exact.value
  const prefix = options.find(
    (option) =>
      option.value.toLowerCase().startsWith(lower) ||
      option.label?.toLowerCase().startsWith(lower) === true,
  )
  return prefix?.value
}

export const personType: ColumnType<string> = {
  ...createTextType({ name: 'person', card: 'meta', groupable: true }),
  parse: (input, column) => {
    const text = toText(input)
    if (text === undefined || text === '') return undefined
    return matchOption(column, text) ?? text
  },
}
