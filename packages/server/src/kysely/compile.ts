import { sql, type RawBuilder, type SqlBool } from 'kysely'
import {
  isRelativeRange,
  resolveRelativeRange,
  type Column,
  type ColumnType,
  type Condition,
  type Filter,
  type Group,
  type Schema,
  type Sort,
  type SortDirection,
} from 'tally-core'
import type { SqlDialect } from '../dialect.ts'

export interface Target {
  readonly column: Column
  readonly type: ColumnType
  readonly ref: RawBuilder<unknown>
}

export interface OrderPart {
  readonly expression: RawBuilder<unknown>
  readonly direction: SortDirection
}

interface Bucket {
  readonly target: Target
  readonly expression: RawBuilder<unknown>
  readonly order: readonly OrderPart[]
}

export interface Compiler {
  target(id: string): Target | undefined
  require(id: string): Target
  isEmpty(target: Target): RawBuilder<SqlBool>
  present(target: Target): RawBuilder<unknown>
  filter(filter: Filter): RawBuilder<SqlBool>
  order(sorts: readonly Sort[]): readonly OrderPart[]
  bucket(group: Group, sorts: readonly Sort[]): Bucket
  rank(target: Target): RawBuilder<unknown>
}

export interface CompilerOptions {
  readonly schema: Schema
  readonly dialect: SqlDialect
  readonly today: string
  readonly columns?: Readonly<Record<string, string>> | undefined
  readonly flags?: Readonly<Record<string, RawBuilder<SqlBool>>> | undefined
}

const FALSE = sql<SqlBool>`false`
const TRUE = sql<SqlBool>`true`

function stringKind(type: ColumnType): boolean {
  return type.kind === 'text' || type.kind === 'enum'
}

function escapeLike(text: string): string {
  return text.replaceAll(/[\\%_]/g, (match) => `\\${match}`)
}

function lowerText(value: unknown): string {
  return String(value).toLowerCase()
}

function all(parts: readonly RawBuilder<SqlBool>[]): RawBuilder<SqlBool> {
  if (parts.length === 0) return TRUE
  return sql<SqlBool>`(${sql.join(parts, sql` and `)})`
}

function any(parts: readonly RawBuilder<SqlBool>[]): RawBuilder<SqlBool> {
  if (parts.length === 0) return FALSE
  return sql<SqlBool>`(${sql.join(parts, sql` or `)})`
}

function not(part: RawBuilder<SqlBool>): RawBuilder<SqlBool> {
  return sql<SqlBool>`(not coalesce(${part}, false))`
}

function pair(value: unknown): readonly [unknown, unknown] {
  return Array.isArray(value) ? [value[0], value[1]] : [undefined, undefined]
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value]
}

export function createCompiler(options: CompilerOptions): Compiler {
  const { schema, dialect, today } = options
  const flags = options.flags ?? {}
  const targets = new Map<string, Target>()
  for (const column of schema.columns) {
    targets.set(column.id, {
      column,
      type: schema.typeOf(column),
      ref: sql.ref(options.columns?.[column.id] ?? column.id),
    })
  }

  const isEmpty = (target: Target): RawBuilder<SqlBool> =>
    stringKind(target.type)
      ? sql<SqlBool>`(${target.ref} is null or ${target.ref} = '')`
      : sql<SqlBool>`${target.ref} is null`

  const present = (target: Target): RawBuilder<unknown> =>
    stringKind(target.type) ? sql`case when ${target.ref} <> '' then ${target.ref} end` : target.ref

  const encode = (target: Target, value: unknown): unknown =>
    dialect.encode(target.type.kind, value)

  const equals = (target: Target, value: unknown): RawBuilder<SqlBool> =>
    target.type.kind === 'text'
      ? sql<SqlBool>`${dialect.lower(target.ref)} = ${lowerText(value)}`
      : sql<SqlBool>`${target.ref} = ${encode(target, value)}`

  const like = (target: Target, pattern: string): RawBuilder<SqlBool> =>
    sql<SqlBool>`${dialect.lower(target.ref)} like ${pattern} escape '\\'`

  const member = (target: Target, values: readonly unknown[]): RawBuilder<SqlBool> => {
    if (values.length === 0) return FALSE
    const items =
      target.type.kind === 'text'
        ? sql.join(values.map(lowerText))
        : sql.join(values.map((value) => encode(target, value)))
    const left = target.type.kind === 'text' ? dialect.lower(target.ref) : target.ref
    return sql<SqlBool>`${left} in (${items})`
  }

  const between = (target: Target, low: unknown, high: unknown): RawBuilder<SqlBool> =>
    sql<SqlBool>`(${target.ref} >= ${encode(target, low)} and ${target.ref} <= ${encode(target, high)})`

  const orEmpty = (target: Target, part: RawBuilder<SqlBool>): RawBuilder<SqlBool> =>
    any([isEmpty(target), not(part)])

  const condition = (node: Condition): RawBuilder<SqlBool> => {
    const target = targets.get(node.column)
    if (target === undefined) return FALSE
    const value = node.value
    switch (node.op) {
      case 'eq':
        return equals(target, value)
      case 'neq':
        return orEmpty(target, equals(target, value))
      case 'lt':
        return sql<SqlBool>`${target.ref} < ${encode(target, value)}`
      case 'lte':
        return sql<SqlBool>`${target.ref} <= ${encode(target, value)}`
      case 'gt':
        return sql<SqlBool>`${target.ref} > ${encode(target, value)}`
      case 'gte':
        return sql<SqlBool>`${target.ref} >= ${encode(target, value)}`
      case 'between': {
        const [low, high] = pair(value)
        return between(target, low, high)
      }
      case 'within': {
        if (!isRelativeRange(value)) return FALSE
        const range = resolveRelativeRange(value, today)
        return between(target, range.start, range.end)
      }
      case 'contains':
        return like(target, `%${escapeLike(lowerText(value))}%`)
      case 'notContains':
        return orEmpty(target, like(target, `%${escapeLike(lowerText(value))}%`))
      case 'startsWith':
        return like(target, `${escapeLike(lowerText(value))}%`)
      case 'endsWith':
        return like(target, `%${escapeLike(lowerText(value))}`)
      case 'in':
        return member(target, list(value))
      case 'notIn':
        return orEmpty(target, member(target, list(value)))
      case 'empty':
        return isEmpty(target)
      case 'notEmpty':
        return not(isEmpty(target))
    }
  }

  const search = (text: string): RawBuilder<SqlBool> => {
    const needle = text.trim().toLowerCase()
    if (needle === '') return TRUE
    const pattern = `%${escapeLike(needle)}%`
    return any(
      [...targets.values()]
        .filter((target) => target.column.searchable ?? target.type.searchable)
        .map(
          (target) =>
            sql<SqlBool>`${dialect.lower(sql`cast(${target.ref} as text)`)} like ${pattern} escape '\\'`,
        ),
    )
  }

  const filter = (node: Filter): RawBuilder<SqlBool> => {
    switch (node.type) {
      case 'condition':
        return condition(node)
      case 'and':
        return all(node.filters.map(filter))
      case 'or':
        return any(node.filters.map(filter))
      case 'not':
        return not(filter(node.filter))
      case 'search':
        return search(node.text)
      case 'flag':
        return Object.hasOwn(flags, node.name) ? (flags[node.name] ?? FALSE) : FALSE
    }
  }

  const rank = (target: Target): RawBuilder<unknown> => {
    const choices = target.column.options ?? []
    if (target.type.kind === 'enum' && choices.length > 0) {
      const branches = sql.join(
        choices.map((option, index) => sql`when ${option.value} then ${index}`),
        sql` `,
      )
      return sql`case ${target.ref} ${branches} else ${choices.length} end`
    }
    return target.type.kind === 'text' ? dialect.lower(target.ref) : target.ref
  }

  const order = (sorts: readonly Sort[]): readonly OrderPart[] =>
    sorts.flatMap((sort) => {
      const target = targets.get(sort.column)
      if (target === undefined) return []
      const value: Target = { ...target, ref: present(target) }
      const parts: OrderPart[] = [
        { expression: isEmpty(target), direction: 'asc' },
        { expression: rank(value), direction: sort.direction },
      ]
      if (target.type.kind === 'enum') {
        parts.push({ expression: value.ref, direction: sort.direction })
      }
      return parts
    })

  const require = (id: string): Target => {
    const target = targets.get(id)
    if (target === undefined) throw new Error(`Unknown column "${id}"`)
    return target
  }

  const bucket = (group: Group, sorts: readonly Sort[]): Bucket => {
    const target = require(group.column)
    const expression =
      target.type.kind === 'date'
        ? dialect.dateBucket(target.ref, group.granularity ?? 'month')
        : present(target)
    const sorted = sorts.find((sort) => sort.column === target.column.id)
    const direction: SortDirection =
      sorted?.direction ?? (target.type.kind === 'date' ? 'desc' : 'asc')
    const bucketTarget: Target = { ...target, ref: expression }
    return {
      target,
      expression,
      order: [
        { expression: isEmpty(bucketTarget), direction: 'asc' },
        { expression: rank(bucketTarget), direction },
      ],
    }
  }

  return {
    target: (id) => targets.get(id),
    require,
    isEmpty,
    present,
    filter,
    order,
    bucket,
    rank,
  }
}
