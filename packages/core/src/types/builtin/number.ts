import type { FormatContext } from '../../format/context.ts'
import { numberFormatter, parseNumber } from '../../format/number.ts'
import type { Column, ColumnFormat } from '../../schema/column.ts'
import type { ColumnType, JsonSchema } from '../column-type.ts'
import { NUMBER_OPERATORS, compareNumbers, isNumber } from './shared.ts'

interface NumberTypeOptions {
  readonly name: string
  readonly card: ColumnType['card']
  readonly schema: JsonSchema
  readonly parse?: ((value: number) => number | undefined) | undefined
  readonly detect?: ((sample: string) => boolean) | undefined
  readonly format: (value: number, format: ColumnFormat, context: FormatContext) => string
}

function decorate(text: string, format: ColumnFormat): string {
  return `${format.prefix ?? ''}${text}${format.suffix ?? ''}`
}

function createNumberType(options: NumberTypeOptions): ColumnType<number> {
  const type: ColumnType<number> = {
    name: options.name,
    kind: 'number',
    operators: NUMBER_OPERATORS,
    aggregates: ['sum', 'avg', 'min', 'max', 'count', 'distinct'],
    facet: 'histogram',
    align: 'end',
    card: options.card,
    searchable: false,
    groupable: false,
    is: isNumber,
    parse: (input) => {
      const value = parseNumber(input)
      if (value === undefined) return undefined
      return options.parse === undefined ? value : options.parse(value)
    },
    format: (value, column, context) =>
      decorate(options.format(value, column.format ?? {}, context), column.format ?? {}),
    compare: compareNumbers,
    jsonSchema: () => options.schema,
  }
  if (options.detect !== undefined) return { ...type, detect: options.detect }
  return type
}

function fractionOptions(format: ColumnFormat, fallback: number): Intl.NumberFormatOptions {
  const digits = format.fractionDigits ?? fallback
  return { minimumFractionDigits: digits, maximumFractionDigits: digits }
}

function signOptions(format: ColumnFormat): Intl.NumberFormatOptions {
  return format.signed === true ? { signDisplay: 'exceptZero' } : {}
}

function compactOptions(format: ColumnFormat): Intl.NumberFormatOptions {
  return format.compact === true ? { notation: 'compact', maximumFractionDigits: 1 } : {}
}

export const numberType: ColumnType<number> = createNumberType({
  name: 'number',
  card: 'metric',
  schema: { type: 'number' },
  detect: (sample) => /^[-+−]?[\d,]*\.?\d+$/.test(sample),
  format: (value, format, context) =>
    numberFormatter(context, {
      ...fractionOptions(format, 2),
      ...signOptions(format),
      ...compactOptions(format),
    }).format(value),
})

export const intType: ColumnType<number> = createNumberType({
  name: 'int',
  card: 'metric',
  schema: { type: 'integer' },
  parse: Math.round,
  detect: (sample) => /^[-+−]?(\d{1,3}(,\d{3})+|\d+)$/.test(sample),
  format: (value, format, context) =>
    numberFormatter(context, {
      maximumFractionDigits: 0,
      ...signOptions(format),
      ...compactOptions(format),
    }).format(value),
})

export const currencyType: ColumnType<number> = createNumberType({
  name: 'currency',
  card: 'metric',
  schema: { type: 'number' },
  detect: (sample) => /^[-−]?[$€£¥₹]\s?[\d,]+(\.\d+)?$/.test(sample),
  format: (value, format, context) =>
    numberFormatter(context, {
      style: 'currency',
      currency: format.currency ?? 'USD',
      ...(format.fractionDigits === undefined ? {} : fractionOptions(format, 2)),
      ...signOptions(format),
      ...compactOptions(format),
    }).format(value),
})

export const percentType: ColumnType<number> = createNumberType({
  name: 'percent',
  card: 'metric',
  schema: { type: 'number' },
  detect: (sample) => /^[-+−]?\d+(\.\d+)?%$/.test(sample),
  format: (value, format, context) =>
    numberFormatter(context, {
      style: 'percent',
      ...fractionOptions(format, 1),
      ...signOptions(format),
    }).format(value / 100),
})

export const barType: ColumnType<number> = {
  ...createNumberType({
    name: 'bar',
    card: 'metric',
    schema: { type: 'integer', minimum: 0, maximum: 100 },
    parse: (value) => Math.min(100, Math.max(0, Math.round(value))),
    format: (value, _format, context) =>
      numberFormatter(context, { maximumFractionDigits: 0 }).format(value),
  }),
  aggregates: ['avg', 'min', 'max', 'count'],
}

const DURATION_SCALE: Readonly<Record<NonNullable<ColumnFormat['durationUnit']>, number>> = {
  milliseconds: 1 / 1000,
  seconds: 1,
  minutes: 60,
}

function parseDuration(input: unknown): number | undefined {
  if (typeof input !== 'string') return parseNumber(input)
  const text = input.trim().toLowerCase()
  const clock = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (clock !== null) {
    const [, first = '0', second = '0', third] = clock
    return third === undefined
      ? Number(first) * 60 + Number(second)
      : Number(first) * 3600 + Number(second) * 60 + Number(third)
  }
  const parts = text.match(/(\d+(?:\.\d+)?)\s*(h|m|s|ms)\b/g)
  if (parts === null) return parseNumber(text)
  const factor: Readonly<Record<string, number>> = { h: 3600, m: 60, s: 1, ms: 0.001 }
  let total = 0
  for (const part of parts) {
    const match = /(\d+(?:\.\d+)?)\s*(h|m|s|ms)/.exec(part)
    if (match === null) continue
    total += Number(match[1]) * (factor[match[2] ?? 's'] ?? 1)
  }
  return total
}

export const durationType: ColumnType<number> = {
  ...createNumberType({
    name: 'duration',
    card: 'metric',
    schema: { type: 'number', minimum: 0 },
    parse: (value) => Math.max(0, value),
    format: (value, format, context) => {
      const seconds = Math.round(value * DURATION_SCALE[format.durationUnit ?? 'seconds'])
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const rest = seconds % 60
      return new Intl.DurationFormat(context.locale, {
        style: 'narrow',
        numberingSystem: context.numberingSystem,
      }).format(
        hours > 0
          ? { hours, minutes }
          : minutes > 0
            ? { minutes, seconds: rest }
            : { seconds: rest },
      )
    },
  }),
  parse: (input) => {
    const value = parseDuration(input)
    return value === undefined ? undefined : Math.max(0, value)
  },
}

export function numberFormatOf(column: Column): ColumnFormat {
  return column.format ?? {}
}
