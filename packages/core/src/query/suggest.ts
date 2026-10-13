import { tokenMatcher, type IToken } from 'chevrotain'
import type { Facets } from '../execute/facets.ts'
import { columnLabel, type Column } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import type { ColumnType } from '../types/column-type.ts'
import {
  And,
  ColumnRef,
  Comma,
  GroupBy,
  LParen,
  OperatorToken,
  Or,
  RParen,
  SortBy,
  tokenize,
} from './lexer.ts'

export type SuggestionKind = 'column' | 'operator' | 'value' | 'directive' | 'example' | 'search'

export interface Suggestion {
  readonly kind: SuggestionKind
  readonly label: string
  readonly insert: string
  readonly detail?: string | undefined
  readonly replace: { readonly start: number; readonly end: number }
}

export interface SuggestOptions {
  readonly facets?: Facets | undefined
  readonly examples?: readonly string[] | undefined
  readonly limit?: number | undefined
}

const OPERATOR_SUGGESTIONS: Readonly<Record<ColumnType['kind'], readonly string[]>> = {
  enum: ['is', 'is not', 'is empty'],
  boolean: ['is yes', 'is no'],
  number: ['>', '<', '>=', '<=', 'between', 'is'],
  date: ['after', 'before', 'last 30 days', 'next 30 days', 'this month', 'is empty'],
  text: ['contains', 'is', 'starts with', 'is empty'],
}

const DATE_VALUES: readonly string[] = [
  'today',
  'yesterday',
  'last 7 days',
  'last 30 days',
  'this week',
  'this month',
  'this quarter',
  'next 30 days',
]

function clauseStart(text: string, cursor: number, schema: Schema): number {
  const { tokens } = tokenize(text.slice(0, cursor), schema)
  let depth = 0
  let start = 0
  for (const token of tokens) {
    if (tokenMatcher(token, LParen)) depth += 1
    else if (tokenMatcher(token, RParen)) depth = Math.max(0, depth - 1)
    else if (
      depth === 0 &&
      (tokenMatcher(token, And) || tokenMatcher(token, Comma) || tokenMatcher(token, Or))
    ) {
      start = token.startOffset + token.image.length
    }
  }
  while (start < cursor && /\s/.test(text.charAt(start))) start += 1
  return start
}

function matches(candidate: string, prefix: string): boolean {
  const lower = candidate.toLowerCase()
  const needle = prefix.toLowerCase()
  return (
    needle === '' ||
    lower.startsWith(needle) ||
    lower.split(/\s+/).some((word) => word.startsWith(needle))
  )
}

function columnKey(column: Column): string {
  return /\s/.test(column.id) ? columnLabel(column) : column.id
}

function quantiles(facets: Facets | undefined, column: Column): readonly number[] {
  const facet = facets?.[column.id]
  if (facet?.kind !== 'histogram') return []
  const min = facet.min
  const max = facet.max
  if (typeof min !== 'number' || typeof max !== 'number') return []
  const span = max - min
  return [0.25, 0.5, 0.75].map((fraction) => {
    const raw = min + span * fraction
    return Math.abs(raw) >= 1000 ? Math.round(raw / 100) * 100 : Math.round(raw)
  })
}

export function suggest(
  text: string,
  cursor: number,
  schema: Schema,
  options: SuggestOptions = {},
): readonly Suggestion[] {
  const limit = options.limit ?? 8
  const start = clauseStart(text, cursor, schema)
  const clause = text.slice(start, cursor)
  const replace = { start, end: cursor }
  const make = (
    kind: SuggestionKind,
    label: string,
    insert: string,
    detail?: string,
  ): Suggestion => ({
    kind,
    label,
    insert,
    replace,
    ...(detail === undefined ? {} : { detail }),
  })
  const output: Suggestion[] = []
  const push = (suggestion: Suggestion): void => {
    if (
      output.length < limit &&
      !output.some((existing) => existing.insert === suggestion.insert)
    ) {
      output.push(suggestion)
    }
  }

  if (clause.trim() === '' && text.trim() === '') {
    for (const example of options.examples ?? []) push(make('example', example, example))
    if (output.length > 0) return output
  }

  const { tokens } = tokenize(clause, schema)
  const trailingSpace = /\s$/.test(clause) || clause === ''
  const first = tokens[0]
  const last = tokens.at(-1)

  const suggestColumns = (
    prefix: string,
    prefixWith: string,
    filter: (column: Column) => boolean,
  ): void => {
    for (const column of schema.columns) {
      if (!filter(column)) continue
      const key = columnKey(column)
      if (matches(key, prefix) || matches(columnLabel(column), prefix)) {
        push(
          make('column', `${prefixWith}${key}`, `${prefixWith}${key} `, schema.typeOf(column).name),
        )
      }
    }
  }

  if (first === undefined) {
    suggestColumns(clause.trim(), '', () => true)
    return output
  }

  if (tokenMatcher(first, SortBy) || tokenMatcher(first, GroupBy)) {
    const directive = tokenMatcher(first, SortBy) ? 'sort by ' : 'group by '
    const prefix = tokens.length > 1 && last !== undefined && !trailingSpace ? last.image : ''
    const alreadyColumn = tokens.length > 1 && last !== undefined && tokenMatcher(last, ColumnRef)
    if (alreadyColumn && tokenMatcher(first, SortBy)) {
      const name = last.image
      push(make('directive', `sort by ${name} asc`, `sort by ${name} asc`))
      push(make('directive', `sort by ${name} desc`, `sort by ${name} desc`))
      return output
    }
    suggestColumns(prefix, directive, (column) =>
      tokenMatcher(first, GroupBy)
        ? (column.groupable ?? schema.typeOf(column).groupable)
        : column.sortable !== false,
    )
    return output
  }

  if (!tokenMatcher(first, ColumnRef)) {
    const prefix = clause.trim()
    suggestColumns(prefix, '', () => true)
    if (matches('sort by', prefix) && prefix !== '') push(make('directive', 'sort by', 'sort by '))
    if (matches('group by', prefix) && prefix !== '')
      push(make('directive', 'group by', 'group by '))
    if (output.length === 0 || tokens.length > 1) push(make('search', `search "${prefix}"`, prefix))
    return output
  }

  const column = schema.resolve(first.image)
  if (column === undefined) return output
  const type = schema.typeOf(column)
  const name = columnKey(column)
  const operatorToken = tokens.find((token) => tokenMatcher(token, OperatorToken))

  if (operatorToken === undefined) {
    const prefix = tokens.length > 1 ? clause.slice(first.image.length).trim() : ''
    if (prefix !== '') suggestColumns(clause.trim(), '', (candidate) => candidate.id !== column.id)
    for (const word of OPERATOR_SUGGESTIONS[type.kind]) {
      if (matches(word, prefix)) push(make('operator', `${name} ${word}`, `${name} ${word} `))
    }
    return output
  }

  const afterOperator = clause.slice(operatorToken.startOffset + operatorToken.image.length).trim()
  const operatorText = clause
    .slice(first.image.length, operatorToken.startOffset + operatorToken.image.length)
    .trim()
  const head = `${name} ${operatorText} `
  const partialOperator = `${operatorText} ${afterOperator}`.toLowerCase()
  for (const word of OPERATOR_SUGGESTIONS[type.kind]) {
    if (word !== operatorText && afterOperator !== '' && word.startsWith(partialOperator)) {
      push(make('operator', `${name} ${word}`, `${name} ${word} `))
    }
  }
  if (type.kind === 'enum') {
    for (const option of column.options ?? []) {
      const label = option.label ?? option.value
      if (matches(label, afterOperator) || matches(option.value, afterOperator)) {
        push(make('value', `${head}${label}`, `${head}${label}`))
      }
    }
  } else if (type.kind === 'boolean') {
    for (const word of ['yes', 'no'])
      if (matches(word, afterOperator)) push(make('value', `${head}${word}`, `${head}${word}`))
  } else if (type.kind === 'date') {
    for (const word of DATE_VALUES)
      if (matches(word, afterOperator)) push(make('value', `${head}${word}`, `${head}${word}`))
  } else if (type.kind === 'number' && afterOperator === '') {
    for (const [index, value] of quantiles(options.facets, column).entries()) {
      push(make('value', `${head}${value}`, `${head}${value}`, `${(index + 1) * 25}th percentile`))
    }
  }
  return output
}

export function tokenAt(text: string, cursor: number, schema: Schema): IToken | undefined {
  return tokenize(text, schema).tokens.find(
    (token) => token.startOffset <= cursor && cursor <= token.startOffset + token.image.length,
  )
}
