import { tokenMatcher, type CstElement, type CstNode, type IToken } from 'chevrotain'
import { parseIsoDate, type RelativeRange, type RelativeUnit } from '../format/date.ts'
import { parseNumber } from '../format/number.ts'
import { columnLabel, type Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import { findOption } from '../types/builtin/enum.ts'
import { parseBoolean } from '../types/builtin/boolean.ts'
import type { ColumnType } from '../types/column-type.ts'
import type { Operator } from '../types/operator.ts'
import {
  and,
  condition,
  flag,
  not,
  or,
  search,
  type Condition,
  type Filter,
  type Group,
  type Query,
  type Sort,
} from './ast.ts'
import { DateLiteral, NotIn, NumberLiteral, QuotedString, unquote } from './lexer.ts'
import type { ParseErrorPosition } from './parser.ts'

export type ClauseKind = 'filter' | 'sort' | 'group' | 'invalid'

export interface Clause {
  readonly kind: ClauseKind
  readonly start: number
  readonly end: number
  readonly text: string
  readonly filter?: Filter | undefined
  readonly sort?: Sort | undefined
  readonly group?: Group | undefined
  readonly error?: ParseErrorPosition | undefined
}

interface Span {
  readonly start: number
  readonly end: number
}

class SemanticError extends Error {
  readonly span: Span

  constructor(message: string, span: Span) {
    super(message)
    this.name = 'SemanticError'
    this.span = span
  }
}

function isNode(element: CstElement): element is CstNode {
  return 'children' in element
}

function nodes(node: CstNode, name: string): readonly CstNode[] {
  return (node.children[name] ?? []).filter(isNode)
}

function isToken(element: CstElement): element is IToken {
  return !isNode(element)
}

function tokens(node: CstNode, name: string): readonly IToken[] {
  return (node.children[name] ?? []).filter(isToken)
}

function firstToken(node: CstNode, name: string): IToken | undefined {
  return tokens(node, name)[0]
}

function allTokens(node: CstNode): IToken[] {
  return Object.values(node.children)
    .flat()
    .flatMap((element) => (isNode(element) ? allTokens(element) : [element]))
}

function spanOf(node: CstNode): Span {
  return spanOfTokens(allTokens(node).toSorted((a, b) => a.startOffset - b.startOffset))
}

function spanOfTokens(list: readonly IToken[]): Span {
  const first = list[0]
  const last = list.at(-1)
  if (first === undefined || last === undefined) return { start: 0, end: 0 }
  return { start: first.startOffset, end: last.startOffset + last.image.length }
}

const UNITS: Readonly<Record<string, RelativeUnit>> = {
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  wk: 'week',
  wks: 'week',
  week: 'week',
  weeks: 'week',
  mo: 'month',
  mos: 'month',
  month: 'month',
  months: 'month',
  q: 'quarter',
  qtr: 'quarter',
  qtrs: 'quarter',
  quarter: 'quarter',
  quarters: 'quarter',
  y: 'year',
  yr: 'year',
  yrs: 'year',
  year: 'year',
  years: 'year',
}

interface Phrase {
  readonly text: string
  readonly tokens: readonly IToken[]
  readonly span: Span
}

export class QueryBuilder {
  readonly #schema: Schema
  readonly #errors: ParseErrorPosition[] = []
  readonly #sorts: Sort[] = []
  #group: Group | undefined
  #endSpan: Span = { start: 0, end: 0 }

  constructor(schema: Schema) {
    this.#schema = schema
  }

  build(
    cst: CstNode | undefined,
    text: string,
  ): { query: Query; clauses: Clause[]; errors: ParseErrorPosition[] } {
    this.#endSpan = { start: text.length, end: text.length }
    const clauses: Clause[] = []
    const root = cst === undefined ? undefined : nodes(cst, 'orExpression')[0]
    let filter: Filter | undefined
    if (root !== undefined) {
      const branches = nodes(root, 'andExpression')
      if (branches.length === 1 && branches[0] !== undefined) {
        const parts = nodes(branches[0], 'unary').map((unary) => this.clause(unary, text))
        clauses.push(...parts)
        filter = and(...parts.map((clause) => clause.filter))
      } else {
        const clause = this.clause(root, text)
        clauses.push(clause)
        filter = clause.filter
      }
    }
    const query: Query = {
      ...(filter === undefined ? {} : { filter }),
      sort: this.#sorts,
      ...(this.#group === undefined ? {} : { group: this.#group }),
    }
    return { query, clauses, errors: this.#errors }
  }

  private clause(node: CstNode, text: string): Clause {
    const span = spanOf(node)
    const base = { start: span.start, end: span.end, text: text.slice(span.start, span.end) }
    const sortsBefore = this.#sorts.length
    const groupBefore = this.#group
    try {
      const filter = node.name === 'unary' ? this.unary(node) : this.orExpression(node)
      if (this.#sorts.length > sortsBefore) {
        return { ...base, kind: 'sort', sort: this.#sorts.at(-1) }
      }
      if (this.#group !== groupBefore) return { ...base, kind: 'group', group: this.#group }
      return filter === undefined
        ? { ...base, kind: 'invalid' }
        : { ...base, kind: 'filter', filter }
    } catch (error) {
      if (!(error instanceof SemanticError)) throw error
      const position = {
        message: error.message,
        offset: error.span.start,
        length: error.span.end - error.span.start,
      }
      this.#errors.push(position)
      return { ...base, kind: 'invalid', error: position }
    }
  }

  private orExpression(node: CstNode): Filter | undefined {
    const branches = nodes(node, 'andExpression').map((branch) => this.andExpression(branch))
    return this.foldOr(branches.filter((branch) => branch !== undefined))
  }

  private andExpression(node: CstNode): Filter | undefined {
    return and(...nodes(node, 'unary').map((unary) => this.guarded(() => this.unary(unary))))
  }

  private guarded(run: () => Filter | undefined): Filter | undefined {
    try {
      return run()
    } catch (error) {
      if (!(error instanceof SemanticError)) throw error
      this.#errors.push({
        message: error.message,
        offset: error.span.start,
        length: error.span.end - error.span.start,
      })
      return undefined
    }
  }

  private unary(node: CstNode): Filter | undefined {
    const inner = nodes(node, 'unary')[0]
    if (inner !== undefined) {
      const filter = this.unary(inner)
      return filter === undefined ? undefined : not(filter)
    }
    const primary = nodes(node, 'primary')[0]
    return primary === undefined ? undefined : this.primary(primary)
  }

  private primary(node: CstNode): Filter | undefined {
    const nested = nodes(node, 'orExpression')[0]
    if (nested !== undefined) return this.orExpression(nested)
    const sort = nodes(node, 'sortDirective')[0]
    if (sort !== undefined) {
      this.sortDirective(sort)
      return undefined
    }
    const group = nodes(node, 'groupDirective')[0]
    if (group !== undefined) {
      this.groupDirective(group)
      return undefined
    }
    const flagToken = firstToken(node, 'Flag')
    if (flagToken !== undefined) return flag(flagToken.image.slice(3))
    const cond = nodes(node, 'condition')[0]
    if (cond !== undefined) return this.condition(cond)
    const phrase = nodes(node, 'phrase')[0]
    if (phrase !== undefined) return search(this.phrase(phrase).text)
    return undefined
  }

  private sortDirective(node: CstNode): void {
    const column = this.columnOf(node)
    const type = this.#schema.typeOf(column)
    if (column.sortable === false) {
      throw new SemanticError(`${columnLabel(column)} cannot be sorted`, spanOf(node))
    }
    const explicit =
      firstToken(node, 'Desc') !== undefined
        ? 'desc'
        : firstToken(node, 'Asc') !== undefined
          ? 'asc'
          : undefined
    const direction = explicit ?? (type.kind === 'number' || type.kind === 'date' ? 'desc' : 'asc')
    this.#sorts.push({ column: column.id, direction })
  }

  private groupDirective(node: CstNode): void {
    const column = this.columnOf(node)
    const type = this.#schema.typeOf(column)
    if (column.groupable === false || (column.groupable !== true && !type.groupable)) {
      throw new SemanticError(`${columnLabel(column)} cannot be grouped`, spanOf(node))
    }
    this.#group = { column: column.id }
  }

  private columnOf(node: CstNode): Column {
    const token = firstToken(node, 'ColumnRef')
    if (token === undefined) throw new SemanticError('Expected a column', spanOf(node))
    const column = this.#schema.resolve(token.image)
    if (column === undefined) {
      throw new SemanticError(`Unknown column "${token.image}"`, spanOfTokens([token]))
    }
    return column
  }

  private condition(node: CstNode): Filter | undefined {
    const column = this.columnOf(node)
    const type = this.#schema.typeOf(column)
    if (column.filterable === false) {
      throw new SemanticError(`${columnLabel(column)} cannot be filtered`, spanOf(node))
    }
    const negate = firstToken(node, 'IsNot') !== undefined
    const isValue = nodes(node, 'isValue')[0]
    if (isValue !== undefined) {
      const filter = this.isValue(isValue, column, type)
      return negate ? not(filter) : filter
    }
    const comparison = this.comparisonOperator(node)
    if (comparison !== undefined) {
      const scalar = nodes(node, 'scalar')[0]
      if (scalar === undefined) throw new SemanticError('Expected a value', spanOf(node))
      return this.compare(column, type, comparison, this.phrase(this.phraseOf(scalar)))
    }
    const textOperator = this.textOperator(node)
    if (textOperator !== undefined) {
      const scalar = nodes(node, 'scalar')[0]
      if (scalar === undefined) throw new SemanticError('Expected a value', spanOf(node))
      const phrase = this.phrase(this.phraseOf(scalar))
      this.ensureOperator(column, type, textOperator, phrase.span)
      return condition(column.id, textOperator, phrase.text)
    }
    const inToken = firstToken(node, 'In') ?? firstToken(node, 'NotIn')
    if (inToken !== undefined) {
      const negated = tokenMatcher(inToken, NotIn)
      const relative = nodes(node, 'relative')[0]
      if (relative !== undefined) {
        const filter = this.within(column, type, relative)
        return negated ? not(filter) : filter
      }
      const list = nodes(node, 'parenList')[0] ?? nodes(node, 'valueList')[0]
      if (list === undefined) throw new SemanticError('Expected values', spanOf(node))
      const values = nodes(list, 'scalar').map((scalar) =>
        this.value(column, type, this.phrase(this.phraseOf(scalar))),
      )
      this.ensureOperator(column, type, 'in', spanOf(list))
      return condition(column.id, negated ? 'notIn' : 'in', values)
    }
    if (firstToken(node, 'Between') !== undefined) {
      const [low, high] = nodes(node, 'scalar')
      if (low === undefined || high === undefined) {
        throw new SemanticError('Expected two values', spanOf(node))
      }
      return this.between(
        column,
        type,
        this.phrase(this.phraseOf(low)),
        this.phrase(this.phraseOf(high)),
      )
    }
    const relative = nodes(node, 'relative')[0]
    if (relative !== undefined) return this.within(column, type, relative)
    const range = nodes(node, 'range')[0]
    if (range !== undefined) return this.range(column, type, range)
    const valueList = nodes(node, 'valueList')[0]
    if (valueList !== undefined) return this.implicit(column, type, valueList)
    throw new SemanticError('Expected an operator and a value', spanOf(node))
  }

  private isValue(node: CstNode, column: Column, type: ColumnType): Filter {
    if (firstToken(node, 'NotEmpty') !== undefined) return condition(column.id, 'notEmpty')
    if (firstToken(node, 'Empty') !== undefined) return condition(column.id, 'empty')
    const relative = nodes(node, 'relative')[0]
    if (relative !== undefined) return this.within(column, type, relative)
    const range = nodes(node, 'range')[0]
    if (range !== undefined) return this.range(column, type, range)
    const valueList = nodes(node, 'valueList')[0]
    if (valueList === undefined) throw new SemanticError('Expected a value', spanOf(node))
    const phrases = nodes(valueList, 'scalar').map((scalar) => this.phrase(this.phraseOf(scalar)))
    if (phrases.length === 1 && phrases[0] !== undefined) {
      return this.equals(column, type, phrases[0])
    }
    this.ensureOperator(column, type, 'in', spanOf(valueList))
    return condition(
      column.id,
      'in',
      phrases.map((phrase) => this.value(column, type, phrase)),
    )
  }

  private implicit(column: Column, type: ColumnType, valueList: CstNode): Filter {
    const phrases = nodes(valueList, 'scalar').map((scalar) => this.phrase(this.phraseOf(scalar)))
    if (type.kind === 'text') {
      return (
        or(...phrases.map((phrase) => condition(column.id, 'contains', phrase.text))) ?? search('')
      )
    }
    if (phrases.length === 1 && phrases[0] !== undefined) {
      return this.equals(column, type, phrases[0])
    }
    return condition(
      column.id,
      'in',
      phrases.map((phrase) => this.value(column, type, phrase)),
    )
  }

  private equals(column: Column, type: ColumnType, phrase: Phrase): Filter {
    if (type.kind === 'date') {
      const partial = this.partialDate(phrase)
      if (partial !== undefined)
        return condition(column.id, 'between', [partial.start, partial.end])
    }
    this.ensureOperator(column, type, 'eq', phrase.span)
    return condition(column.id, 'eq', this.value(column, type, phrase))
  }

  private compare(column: Column, type: ColumnType, op: Operator, phrase: Phrase): Filter {
    this.ensureOperator(column, type, op, phrase.span)
    if (type.kind === 'date') {
      const partial = this.partialDate(phrase)
      if (partial !== undefined) {
        const edge = op === 'gt' || op === 'lte' ? partial.end : partial.start
        return condition(column.id, op, edge)
      }
    }
    return condition(column.id, op, this.value(column, type, phrase))
  }

  private between(column: Column, type: ColumnType, low: Phrase, high: Phrase): Filter {
    this.ensureOperator(column, type, 'between', { start: low.span.start, end: high.span.end })
    const start = this.rangeEdge(column, type, low, 'start')
    const end = this.rangeEdge(column, type, high, 'end')
    return condition(column.id, 'between', this.orderRange(type, start, end))
  }

  private range(column: Column, type: ColumnType, node: CstNode): Filter {
    const [low, high] = nodes(node, 'literal')
    if (low === undefined || high === undefined)
      throw new SemanticError('Expected a range', spanOf(node))
    return this.between(column, type, this.literal(low), this.literal(high))
  }

  private literal(node: CstNode): Phrase {
    const list = [
      ...tokens(node, 'NumberLiteral'),
      ...tokens(node, 'DateLiteral'),
      ...tokens(node, 'QuotedString'),
    ]
    return this.phraseFromTokens(list)
  }

  private rangeEdge(
    column: Column,
    type: ColumnType,
    phrase: Phrase,
    edge: 'start' | 'end',
  ): unknown {
    if (type.kind === 'date') {
      const partial = this.partialDate(phrase)
      if (partial !== undefined) return partial[edge]
    }
    return this.value(column, type, phrase)
  }

  private orderRange(type: ColumnType, start: unknown, end: unknown): readonly [unknown, unknown] {
    if (
      type.kind === 'number' &&
      typeof start === 'number' &&
      typeof end === 'number' &&
      start > end
    ) {
      return [end, start]
    }
    if (
      type.kind === 'date' &&
      typeof start === 'string' &&
      typeof end === 'string' &&
      start > end
    ) {
      return [end, start]
    }
    return [start, end]
  }

  private within(column: Column, type: ColumnType, node: CstNode): Filter {
    this.ensureOperator(column, type, 'within', spanOf(node))
    return condition(column.id, 'within', this.relative(node))
  }

  private relative(node: CstNode): RelativeRange {
    if (firstToken(node, 'Today') !== undefined)
      return { direction: 'this', amount: 1, unit: 'day' }
    if (firstToken(node, 'Yesterday') !== undefined) {
      return { direction: 'this', amount: 1, unit: 'day', shift: -1 }
    }
    if (firstToken(node, 'Tomorrow') !== undefined) {
      return { direction: 'this', amount: 1, unit: 'day', shift: 1 }
    }
    const unitToken = firstToken(node, 'Unit')
    const unit = unitToken === undefined ? undefined : UNITS[unitToken.image.toLowerCase()]
    if (unit === undefined) throw new SemanticError('Expected a time unit', spanOf(node))
    if (firstToken(node, 'This') !== undefined) return { direction: 'this', amount: 1, unit }
    const amountToken = firstToken(node, 'NumberLiteral')
    const amount = amountToken === undefined ? 1 : parseNumber(amountToken.image)
    if (amount === undefined || amount <= 0 || !Number.isInteger(amount)) {
      throw new SemanticError('Expected a whole number of periods', spanOf(node))
    }
    const direction = firstToken(node, 'Next') !== undefined ? 'next' : 'last'
    return { direction, amount, unit }
  }

  private partialDate(phrase: Phrase): { start: string; end: string } | undefined {
    const only = phrase.tokens.length === 1 ? phrase.tokens[0] : undefined
    if (only === undefined) return undefined
    if (tokenMatcher(only, DateLiteral) && only.image.length === 7) {
      const start = `${only.image}-01`
      const [year, month] = only.image.split('-').map(Number)
      const lastDay = new Date(Date.UTC(year ?? 0, month ?? 1, 0)).getUTCDate()
      return { start, end: `${only.image}-${String(lastDay).padStart(2, '0')}` }
    }
    if (tokenMatcher(only, NumberLiteral) && /^\d{4}$/.test(only.image)) {
      return { start: `${only.image}-01-01`, end: `${only.image}-12-31` }
    }
    return undefined
  }

  private value(column: Column, type: ColumnType, phrase: Phrase): unknown {
    const only = phrase.tokens.length === 1 ? phrase.tokens[0] : undefined
    if (type.kind === 'enum') {
      const option = findOption(column, phrase.text)
      if (option === undefined) {
        throw new SemanticError(
          `"${phrase.text}" is not a ${columnLabel(column)} option`,
          phrase.span,
        )
      }
      return option.value
    }
    if (type.kind === 'boolean') {
      const parsed = parseBoolean(phrase.text)
      if (parsed === undefined)
        throw new SemanticError(`"${phrase.text}" is not yes or no`, phrase.span)
      return parsed
    }
    if (type.kind === 'number') {
      const parsed = type.parse(phrase.text, column)
      if (parsed === undefined)
        throw new SemanticError(`"${phrase.text}" is not a number`, phrase.span)
      return parsed
    }
    if (type.kind === 'date') {
      const parsed =
        only !== undefined && tokenMatcher(only, DateLiteral)
          ? parseIsoDate(only.image)
          : parseIsoDate(phrase.text)
      if (parsed === undefined)
        throw new SemanticError(`"${phrase.text}" is not a date`, phrase.span)
      return parsed
    }
    const parsed = type.parse(phrase.text, column)
    if (parsed === undefined) {
      throw new SemanticError(
        `"${phrase.text}" is not valid for ${columnLabel(column)}`,
        phrase.span,
      )
    }
    return parsed
  }

  private ensureOperator(column: Column, type: ColumnType, op: Operator, span: Span): void {
    if (!type.operators.includes(op)) {
      throw new SemanticError(`${columnLabel(column)} does not support "${op}"`, span)
    }
  }

  private comparisonOperator(node: CstNode): Operator | undefined {
    if (firstToken(node, 'Gte') !== undefined) return 'gte'
    if (firstToken(node, 'Lte') !== undefined) return 'lte'
    if (firstToken(node, 'Gt') !== undefined) return 'gt'
    if (firstToken(node, 'Lt') !== undefined) return 'lt'
    return undefined
  }

  private textOperator(node: CstNode): Operator | undefined {
    if (firstToken(node, 'NotContains') !== undefined) return 'notContains'
    if (firstToken(node, 'Contains') !== undefined) return 'contains'
    if (firstToken(node, 'StartsWith') !== undefined) return 'startsWith'
    if (firstToken(node, 'EndsWith') !== undefined) return 'endsWith'
    return undefined
  }

  private phraseOf(scalar: CstNode): CstNode {
    const phrase = nodes(scalar, 'phrase')[0]
    if (phrase === undefined) throw new SemanticError('Expected a value', this.#endSpan)
    return phrase
  }

  private phrase(node: CstNode): Phrase {
    const list = tokens(node, 'Term').toSorted((a, b) => a.startOffset - b.startOffset)
    if (list.length === 0) throw new SemanticError('Expected a value', this.#endSpan)
    return this.phraseFromTokens(list)
  }

  private phraseFromTokens(list: readonly IToken[]): Phrase {
    const text = list
      .map((token) => (tokenMatcher(token, QuotedString) ? unquote(token.image) : token.image))
      .join(' ')
    return { text, tokens: list, span: spanOfTokens(list) }
  }

  private foldOr(filters: readonly Filter[]): Filter | undefined {
    const merged: Filter[] = []
    for (const filter of filters) {
      const previous = merged.at(-1)
      const combined = previous === undefined ? undefined : this.mergeOr(previous, filter)
      if (combined === undefined) merged.push(filter)
      else merged[merged.length - 1] = combined
    }
    return or(...merged)
  }

  private mergeOr(left: Filter, right: Filter): Filter | undefined {
    if (left.type !== 'condition') return undefined
    const column = this.#schema.column(left.column)
    if (column === undefined) return undefined
    const type = this.#schema.typeOf(column)
    if (!type.operators.includes('in')) return undefined
    const leftValues = this.inValues(left)
    if (leftValues === undefined) return undefined
    if (right.type === 'condition' && right.column === left.column) {
      const rightValues = this.inValues(right)
      if (rightValues === undefined) return undefined
      return condition(left.column, 'in', [...leftValues, ...rightValues])
    }
    if (right.type === 'search' && type.kind === 'enum') {
      const option = findOption(column, right.text)
      if (option === undefined) return undefined
      return condition(left.column, 'in', [...leftValues, option.value])
    }
    return undefined
  }

  private inValues(filter: Condition): readonly unknown[] | undefined {
    if (filter.op === 'eq') return [filter.value]
    if (filter.op === 'in' && Array.isArray(filter.value)) return filter.value as readonly unknown[]
    return undefined
  }
}
