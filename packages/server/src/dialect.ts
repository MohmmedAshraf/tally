import { sql, type RawBuilder } from 'kysely'
import type { GroupGranularity, ValueKind } from 'tally-core'

export interface SqlDialect {
  readonly name: string
  lower(expression: RawBuilder<unknown>): RawBuilder<string>
  float(expression: RawBuilder<unknown>): RawBuilder<number>
  floor(expression: RawBuilder<unknown>): RawBuilder<number>
  dayNumber(expression: RawBuilder<unknown>): RawBuilder<number>
  dateBucket(expression: RawBuilder<unknown>, granularity: GroupGranularity): RawBuilder<string>
  encode(kind: ValueKind, value: unknown): unknown
  decode(kind: ValueKind, value: unknown): unknown
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoOf(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function decode(kind: ValueKind, value: unknown): unknown {
  if (value === null || value === undefined) return null
  switch (kind) {
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'boolean':
      return typeof value === 'boolean' ? value : Number(value) !== 0
    case 'date':
      return value instanceof Date ? isoOf(value) : value
    case 'text':
    case 'enum':
      return value
  }
}

export const sqliteDialect: SqlDialect = {
  name: 'sqlite',
  lower: (expression) => sql<string>`lower(${expression})`,
  float: (expression) => sql<number>`cast(${expression} as real)`,
  floor: (expression) => sql<number>`floor(${expression})`,
  dayNumber: (expression) =>
    sql<number>`cast(julianday(${expression}) - julianday('1970-01-01') as integer)`,
  dateBucket: (expression, granularity) => {
    switch (granularity) {
      case 'day':
        return sql<string>`${expression}`
      case 'week':
        return sql<string>`date(${expression}, '-' || ((strftime('%w', ${expression}) + 6) % 7) || ' days')`
      case 'month':
        return sql<string>`substr(${expression}, 1, 7)`
      case 'quarter':
        return sql<string>`strftime('%Y', ${expression}) || '-Q' || ((strftime('%m', ${expression}) - 1) / 3 + 1)`
      case 'year':
        return sql<string>`strftime('%Y', ${expression})`
    }
  },
  encode: (kind, value) =>
    kind === 'boolean' && typeof value === 'boolean' ? Number(value) : value,
  decode,
}

export const postgresDialect: SqlDialect = {
  name: 'postgres',
  lower: (expression) => sql<string>`lower(${expression})`,
  float: (expression) => sql<number>`cast(${expression} as double precision)`,
  floor: (expression) => sql<number>`floor(${expression})`,
  dayNumber: (expression) => sql<number>`(cast(${expression} as date) - date '1970-01-01')`,
  dateBucket: (expression, granularity) => {
    const date = sql`cast(${expression} as date)`
    switch (granularity) {
      case 'day':
        return sql<string>`to_char(${date}, 'YYYY-MM-DD')`
      case 'week':
        return sql<string>`to_char(date_trunc('week', ${date}), 'YYYY-MM-DD')`
      case 'month':
        return sql<string>`to_char(${date}, 'YYYY-MM')`
      case 'quarter':
        return sql<string>`to_char(${date}, 'YYYY-"Q"Q')`
      case 'year':
        return sql<string>`to_char(${date}, 'YYYY')`
    }
  },
  encode: (_kind, value) => value,
  decode,
}
