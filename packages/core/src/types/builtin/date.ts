import { compareIsoDates, formatIsoDate, isIsoDate, parseIsoDate } from '../../format/date.ts'
import type { ColumnFormat } from '../../schema/column.ts'
import type { ColumnType } from '../column-type.ts'
import { DATE_OPERATORS, isString } from './shared.ts'

const DATE_STYLES: Readonly<
  Record<NonNullable<ColumnFormat['dateStyle']>, Intl.DateTimeFormatOptions>
> = {
  short: { year: 'numeric', month: 'numeric', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
}

export const dateType: ColumnType<string> = {
  name: 'date',
  kind: 'date',
  operators: DATE_OPERATORS,
  aggregates: ['min', 'max', 'count', 'distinct'],
  facet: 'histogram',
  align: 'start',
  card: 'meta',
  searchable: false,
  groupable: true,
  is: (value): value is string => isString(value) && isIsoDate(value),
  parse: (input) => parseIsoDate(input),
  format: (value, column, context) =>
    formatIsoDate(value, context, DATE_STYLES[column.format?.dateStyle ?? 'medium']),
  compare: compareIsoDates,
  detect: (sample) => isIsoDate(sample),
  jsonSchema: () => ({ type: 'string', format: 'date' }),
}
