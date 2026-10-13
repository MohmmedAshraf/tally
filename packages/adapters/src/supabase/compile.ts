import {
  isRelativeRange,
  resolveRelativeRange,
  type Column,
  type ColumnType,
  type Condition,
  type Filter,
  type Schema,
  type Sort,
} from 'tally-core'

export interface CompileOptions {
  readonly schema: Schema
  readonly today: string
  readonly key: string
  readonly columns?: Readonly<Record<string, string>> | undefined
}

interface OrderPart {
  readonly column: string
  readonly ascending: boolean
}

interface Target {
  readonly column: Column
  readonly type: ColumnType
  readonly name: string
}

type Node =
  | { readonly kind: 'leaf'; readonly text: string }
  | { readonly kind: 'and' | 'or'; readonly parts: readonly Node[] }

function leaf(text: string): Node {
  return { kind: 'leaf', text }
}

function join(kind: 'and' | 'or', parts: readonly Node[]): Node {
  const flat = parts.flatMap((part) => (part.kind === kind ? part.parts : [part]))
  return flat.length === 1 && flat[0] !== undefined ? flat[0] : { kind, parts: flat }
}

function all(parts: readonly Node[]): Node {
  return join('and', parts)
}

function any(parts: readonly Node[]): Node {
  return join('or', parts)
}

function inverted(operator: Condition['op']): boolean {
  return (
    operator === 'neq' ||
    operator === 'notContains' ||
    operator === 'notIn' ||
    operator === 'notEmpty'
  )
}

function quote(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function escapeLike(text: string): string {
  return text.replaceAll(/[\\%_]/g, (match) => `\\${match}`)
}

function lowerText(value: unknown): string {
  return String(value).toLowerCase()
}

function stringKind(type: ColumnType): boolean {
  return type.kind === 'text' || type.kind === 'enum'
}

function pair(value: unknown): readonly [unknown, unknown] {
  return Array.isArray(value) ? [value[0], value[1]] : [undefined, undefined]
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value]
}

function literal(target: Target, value: unknown): string {
  switch (target.type.kind) {
    case 'number':
      return String(Number(value))
    case 'boolean':
      return value === true ? 'true' : 'false'
    case 'text':
    case 'enum':
    case 'date':
      return quote(String(value))
  }
}

function serialize(node: Node): string {
  if (node.kind === 'leaf') return node.text
  return `${node.kind}(${node.parts.map(serialize).join(',')})`
}

export interface Compiler {
  readonly filter: (filter: Filter) => string
  readonly order: (sorts: readonly Sort[]) => readonly OrderPart[]
  readonly name: (id: string) => string
  readonly selection: () => string
}

export function createCompiler(options: CompileOptions): Compiler {
  const { schema, today } = options
  const name = (id: string): string => options.columns?.[id] ?? id
  const targets = new Map<string, Target>(
    schema.columns.map((column) => [
      column.id,
      { column, type: schema.typeOf(column), name: name(column.id) },
    ]),
  )
  const keyName = name(options.key)
  const TRUE = leaf(`${keyName}.not.is.null`)
  const FALSE = leaf(`${keyName}.is.null`)

  const isEmpty = (target: Target): Node =>
    stringKind(target.type)
      ? any([leaf(`${target.name}.is.null`), leaf(`${target.name}.eq.${quote('')}`)])
      : leaf(`${target.name}.is.null`)
  const notEmpty = (target: Target): Node =>
    stringKind(target.type)
      ? all([leaf(`${target.name}.not.is.null`), leaf(`${target.name}.neq.${quote('')}`)])
      : leaf(`${target.name}.not.is.null`)

  const op = (target: Target, operator: string, value: string, negated = false): Node =>
    leaf(`${target.name}.${negated ? 'not.' : ''}${operator}.${value}`)

  const equals = (target: Target, value: unknown, negated = false): Node => {
    if (target.type.kind === 'text') {
      return op(target, 'ilike', quote(escapeLike(lowerText(value))), negated)
    }
    if (target.type.kind === 'boolean') return op(target, 'is', literal(target, value), negated)
    return op(target, negated ? 'neq' : 'eq', literal(target, value))
  }
  const like = (target: Target, pattern: string, negated = false): Node =>
    op(target, 'ilike', quote(pattern), negated)
  const member = (target: Target, values: readonly unknown[], negated = false): Node => {
    if (values.length === 0) return negated ? TRUE : FALSE
    if (target.type.kind === 'text') {
      const parts = values.map((value) => equals(target, value, negated))
      return negated ? all(parts) : any(parts)
    }
    const items = values.map((value) => literal(target, value)).join(',')
    return op(target, 'in', `(${items})`, negated)
  }
  const between = (target: Target, low: unknown, high: unknown, negated = false): Node => {
    const parts = [
      op(target, 'gte', literal(target, low), negated),
      op(target, 'lte', literal(target, high), negated),
    ]
    return negated ? any(parts) : all(parts)
  }
  const compare = (target: Target, operator: string, value: unknown, negated: boolean): Node =>
    op(target, operator, literal(target, value), negated)

  const positive = (target: Target, node: Condition, negated: boolean): Node => {
    const value = node.value
    switch (node.op) {
      case 'eq':
      case 'neq':
        return equals(target, value, negated)
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte':
        return compare(target, node.op, value, negated)
      case 'between': {
        const [low, high] = pair(value)
        return between(target, low, high, negated)
      }
      case 'within': {
        if (!isRelativeRange(value)) return negated ? TRUE : FALSE
        const range = resolveRelativeRange(value, today)
        return between(target, range.start, range.end, negated)
      }
      case 'contains':
      case 'notContains':
        return like(target, `%${escapeLike(lowerText(value))}%`, negated)
      case 'startsWith':
        return like(target, `${escapeLike(lowerText(value))}%`, negated)
      case 'endsWith':
        return like(target, `%${escapeLike(lowerText(value))}`, negated)
      case 'in':
      case 'notIn':
        return member(target, list(value), negated)
      case 'empty':
      case 'notEmpty':
        return negated ? notEmpty(target) : isEmpty(target)
    }
  }

  const condition = (node: Condition, negate: boolean): Node => {
    const target = targets.get(node.column)
    if (target === undefined) return negate ? TRUE : FALSE
    if (node.op === 'empty' || node.op === 'notEmpty') {
      return positive(target, node, inverted(node.op) !== negate)
    }
    if (inverted(node.op) !== negate) {
      return any([isEmpty(target), positive(target, node, true)])
    }
    return positive(target, node, false)
  }

  const searchable = (): readonly Target[] =>
    [...targets.values()].filter(
      (target) => stringKind(target.type) && (target.column.searchable ?? target.type.searchable),
    )

  const search = (text: string, negate: boolean): Node => {
    const needle = text.trim().toLowerCase()
    if (needle === '') return negate ? FALSE : TRUE
    const pattern = `%${escapeLike(needle)}%`
    const columns = searchable()
    if (columns.length === 0) return negate ? TRUE : FALSE
    return negate
      ? all(columns.map((target) => any([isEmpty(target), like(target, pattern, true)])))
      : any(columns.map((target) => like(target, pattern)))
  }

  const compile = (node: Filter, negate: boolean): Node => {
    switch (node.type) {
      case 'condition':
        return condition(node, negate)
      case 'and': {
        if (node.filters.length === 0) return negate ? FALSE : TRUE
        const parts = node.filters.map((child) => compile(child, negate))
        return negate ? any(parts) : all(parts)
      }
      case 'or': {
        if (node.filters.length === 0) return negate ? TRUE : FALSE
        const parts = node.filters.map((child) => compile(child, negate))
        return negate ? all(parts) : any(parts)
      }
      case 'not':
        return compile(node.filter, !negate)
      case 'search':
        return search(node.text, negate)
      case 'flag':
        return negate ? TRUE : FALSE
    }
  }

  return {
    name,
    filter: (filter) => serialize(compile(filter, false)),
    order: (sorts) => [
      ...sorts.flatMap((sort) => {
        const target = targets.get(sort.column)
        return target === undefined
          ? []
          : [{ column: target.name, ascending: sort.direction === 'asc' }]
      }),
      { column: keyName, ascending: true },
    ],
    selection: () =>
      [
        ...schema.columns.map((column) => {
          const mapped = name(column.id)
          return mapped === column.id ? column.id : `${column.id}:${mapped}`
        }),
        ...(schema.column(options.key) === undefined
          ? [keyName === options.key ? options.key : `${options.key}:${keyName}`]
          : []),
      ].join(','),
  }
}
