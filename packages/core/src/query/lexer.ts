import { createToken, Lexer, type IToken, type TokenType } from 'chevrotain'
import type { Schema } from '../schema/schema.ts'

const BOUNDARY = /[\p{L}\p{N}_]/u

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordsPattern(words: readonly string[]): RegExp {
  const alternatives = words
    .toSorted((a, b) => b.length - a.length)
    .map((word) => escapeRegExp(word).replace(/\s+/g, '\\s+'))
  return new RegExp(`(?:${alternatives.join('|')})`, 'iuy')
}

function matcher(pattern: RegExp): (text: string, offset: number) => [string] | null {
  return (text, offset) => {
    pattern.lastIndex = offset
    const match = pattern.exec(text)
    if (match === null) return null
    const end = offset + match[0].length
    const before = offset > 0 ? text.charAt(offset - 1) : ''
    const after = text.charAt(end)
    const startsWithWord = BOUNDARY.test(match[0].charAt(0))
    const endsWithWord = BOUNDARY.test(match[0].charAt(match[0].length - 1))
    if (startsWithWord && BOUNDARY.test(before)) return null
    if (endsWithWord && BOUNDARY.test(after)) return null
    return [match[0]]
  }
}

export const Term: TokenType = createToken({ name: 'Term', pattern: Lexer.NA })
export const OperatorToken: TokenType = createToken({ name: 'OperatorToken', pattern: Lexer.NA })

interface KeywordSpec {
  readonly name: string
  readonly words: readonly string[]
  readonly term?: boolean | undefined
  readonly operator?: boolean | undefined
}

const keywordWords = new Set<string>()

function keyword(spec: KeywordSpec): TokenType {
  for (const word of spec.words) keywordWords.add(word.toLowerCase())
  const categories: TokenType[] = []
  if (spec.term !== false) categories.push(Term)
  if (spec.operator === true) categories.push(OperatorToken)
  return createToken({
    name: spec.name,
    pattern: { exec: matcher(wordsPattern(spec.words)) },
    line_breaks: false,
    start_chars_hint: [...new Set(spec.words.map((word) => word.charAt(0)))].flatMap((char) => [
      char.toLowerCase(),
      char.toUpperCase(),
    ]),
    categories,
  })
}

const WhiteSpace: TokenType = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
})

export const QuotedString: TokenType = createToken({
  name: 'QuotedString',
  pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
  categories: [Term],
})

export const Flag: TokenType = createToken({
  name: 'Flag',
  pattern: { exec: matcher(/is:[\p{L}\p{N}_-]+/uy) },
  line_breaks: false,
  start_chars_hint: ['i', 'I'],
})

export const LParen: TokenType = createToken({ name: 'LParen', pattern: /\(/ })
export const RParen: TokenType = createToken({ name: 'RParen', pattern: /\)/ })
export const Comma: TokenType = createToken({ name: 'Comma', pattern: /,/ })
export const DotDot: TokenType = createToken({ name: 'DotDot', pattern: /\.\./ })

export const And: TokenType = keyword({ name: 'And', words: ['and', '&&', '&'], term: false })
export const Or: TokenType = keyword({ name: 'Or', words: ['or', '||', '|'], term: false })
export const Not: TokenType = keyword({ name: 'Not', words: ['not'], term: false })

export const SortBy: TokenType = keyword({
  name: 'SortBy',
  words: ['sort by', 'sorted by', 'order by', 'ordered by', 'sort', 'order'],
  term: false,
})
export const GroupBy: TokenType = keyword({
  name: 'GroupBy',
  words: ['group by', 'grouped by', 'group'],
  term: false,
})
export const Asc: TokenType = keyword({
  name: 'Asc',
  words: ['asc', 'ascending', 'low to high', 'lowest first', 'oldest first', 'a to z'],
})
export const Desc: TokenType = keyword({
  name: 'Desc',
  words: ['desc', 'descending', 'high to low', 'highest first', 'newest first', 'z to a'],
})

export const IsNot: TokenType = keyword({
  name: 'IsNot',
  words: ['is not', "isn't", 'isnt', 'not equal to', 'does not equal', 'except', '!=', '<>', '≠'],
  term: false,
  operator: true,
})
export const Is: TokenType = keyword({
  name: 'Is',
  words: ['is', 'equals', 'equal to', '==', '=', ':'],
  term: false,
  operator: true,
})
export const Gte: TokenType = keyword({
  name: 'Gte',
  words: ['at least', 'on or after', 'no less than', '>=', '≥'],
  term: false,
  operator: true,
})
export const Lte: TokenType = keyword({
  name: 'Lte',
  words: ['at most', 'on or before', 'no more than', 'up to', '<=', '≤'],
  term: false,
  operator: true,
})
export const Gt: TokenType = keyword({
  name: 'Gt',
  words: ['more than', 'greater than', 'later than', 'over', 'above', 'after', 'since', '>'],
  term: false,
  operator: true,
})
export const Lt: TokenType = keyword({
  name: 'Lt',
  words: ['less than', 'fewer than', 'earlier than', 'under', 'below', 'before', '<'],
  term: false,
  operator: true,
})
export const NotContains: TokenType = keyword({
  name: 'NotContains',
  words: ['does not contain', "doesn't contain", 'not containing', 'excludes', 'without'],
  term: false,
  operator: true,
})
export const Contains: TokenType = keyword({
  name: 'Contains',
  words: ['contains', 'containing', 'includes', 'has', 'like', '~'],
  term: false,
  operator: true,
})
export const StartsWith: TokenType = keyword({
  name: 'StartsWith',
  words: ['starts with', 'begins with', 'starting with'],
  term: false,
  operator: true,
})
export const EndsWith: TokenType = keyword({
  name: 'EndsWith',
  words: ['ends with', 'ending with'],
  term: false,
  operator: true,
})
export const NotIn: TokenType = keyword({
  name: 'NotIn',
  words: ['not in', 'none of', 'not one of', 'not any of'],
  term: false,
  operator: true,
})
export const In: TokenType = keyword({
  name: 'In',
  words: ['in', 'one of', 'any of'],
  term: false,
  operator: true,
})
export const Between: TokenType = keyword({
  name: 'Between',
  words: ['between'],
  term: false,
  operator: true,
})
export const Within: TokenType = keyword({
  name: 'Within',
  words: ['within', 'during'],
  term: false,
  operator: true,
})
export const To: TokenType = keyword({ name: 'To', words: ['to', 'through'] })

export const Empty: TokenType = keyword({
  name: 'Empty',
  words: ['empty', 'blank', 'missing', 'null', 'unset'],
  term: false,
})
export const NotEmpty: TokenType = keyword({
  name: 'NotEmpty',
  words: ['not empty', 'not blank', 'set', 'filled', 'present'],
  term: false,
})

export const Last: TokenType = keyword({
  name: 'Last',
  words: ['last', 'past', 'previous'],
  term: false,
})
export const Next: TokenType = keyword({
  name: 'Next',
  words: ['next', 'coming', 'upcoming'],
  term: false,
})
export const This: TokenType = keyword({ name: 'This', words: ['this', 'current'], term: false })
export const Today: TokenType = keyword({ name: 'Today', words: ['today'], term: false })
export const Yesterday: TokenType = keyword({
  name: 'Yesterday',
  words: ['yesterday'],
  term: false,
})
export const Tomorrow: TokenType = keyword({ name: 'Tomorrow', words: ['tomorrow'], term: false })
export const Unit: TokenType = keyword({
  name: 'Unit',
  words: [
    'days',
    'day',
    'd',
    'weeks',
    'week',
    'wks',
    'wk',
    'w',
    'months',
    'month',
    'mos',
    'mo',
    'quarters',
    'quarter',
    'qtrs',
    'qtr',
    'q',
    'years',
    'year',
    'yrs',
    'yr',
    'y',
  ],
})
const BoolWord: TokenType = keyword({
  name: 'BoolWord',
  words: ['true', 'false', 'yes', 'no'],
})

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export const DateLiteral: TokenType = createToken({
  name: 'DateLiteral',
  pattern: { exec: matcher(/\d{4}-\d{2}(?:-\d{2})?/y) },
  line_breaks: false,
  start_chars_hint: DIGITS,
  categories: [Term],
})

export const NumberLiteral: TokenType = createToken({
  name: 'NumberLiteral',
  pattern: {
    exec: matcher(/[-+−]?[$€£¥₹]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?(?:[kmb]\b|%)?/iy),
  },
  line_breaks: false,
  start_chars_hint: ['-', '+', '−', '$', '€', '£', '¥', '₹', '.', ...DIGITS],
  categories: [Term],
})

const Word: TokenType = createToken({
  name: 'Word',
  pattern: { exec: matcher(/[\p{L}\p{N}_#@][\p{L}\p{N}_\-'’.#@/]*/uy) },
  line_breaks: false,
  categories: [Term],
})

type Matcher = (text: string, offset: number) => [string] | null

interface SchemaMatchers {
  readonly column: Matcher
  readonly option: Matcher
}

const never: Matcher = () => null

let active: SchemaMatchers = { column: never, option: never }

export const ColumnRef: TokenType = createToken({
  name: 'ColumnRef',
  pattern: Lexer.NA,
  categories: [Term],
})

const OptionRef: TokenType = createToken({
  name: 'OptionRef',
  pattern: Lexer.NA,
  categories: [Term],
})

const ColumnWord: TokenType = createToken({
  name: 'ColumnWord',
  pattern: { exec: (text, offset) => active.column(text, offset) },
  line_breaks: false,
  categories: [Term, ColumnRef],
})

const OptionWord: TokenType = createToken({
  name: 'OptionWord',
  pattern: { exec: (text, offset) => active.option(text, offset) },
  line_breaks: false,
  categories: [Term, OptionRef],
})

const staticTokens: readonly TokenType[] = [
  WhiteSpace,
  QuotedString,
  Flag,
  LParen,
  RParen,
  Comma,
  DotDot,
  And,
  Or,
  SortBy,
  GroupBy,
  Asc,
  Desc,
  IsNot,
  NotIn,
  NotContains,
  NotEmpty,
  Not,
  Is,
  Gte,
  Lte,
  Gt,
  Lt,
  Contains,
  StartsWith,
  EndsWith,
  In,
  Between,
  Within,
  To,
  Empty,
  Last,
  Next,
  This,
  Today,
  Yesterday,
  Tomorrow,
  Unit,
  BoolWord,
  DateLiteral,
  NumberLiteral,
  Word,
]

export const allTokens: readonly TokenType[] = [ColumnRef, OptionRef, ...staticTokens]

const matchers = new WeakMap<Schema, SchemaMatchers>()

function wordsMatcher(names: readonly string[]): Matcher {
  return names.length === 0 ? never : matcher(wordsPattern(names))
}

function optionNames(schema: Schema): readonly string[] {
  const names = new Set<string>()
  for (const column of schema.columns) {
    for (const option of column.options ?? []) {
      for (const text of [option.value, option.label ?? option.value]) {
        const normalized = text.trim().toLowerCase()
        if (normalized.length > 0 && !keywordWords.has(normalized)) names.add(normalized)
      }
    }
  }
  return [...names]
}

function matchersFor(schema: Schema): SchemaMatchers {
  let entry = matchers.get(schema)
  if (entry === undefined) {
    entry = {
      column: wordsMatcher(schema.names().map((name) => name.name)),
      option: wordsMatcher(optionNames(schema)),
    }
    matchers.set(schema, entry)
  }
  return entry
}

const lexer = new Lexer(
  [...staticTokens.slice(0, 3), ColumnWord, OptionWord, ...staticTokens.slice(3)],
  {
    positionTracking: 'onlyOffset',
    ensureOptimizations: false,
    skipValidations: false,
  },
)

export interface LexResult {
  readonly tokens: readonly IToken[]
  readonly errors: readonly { readonly offset: number; readonly length: number }[]
}

export function tokenize(text: string, schema: Schema): LexResult {
  active = matchersFor(schema)
  const result = lexer.tokenize(text)
  active = { column: never, option: never }
  return {
    tokens: result.tokens,
    errors: result.errors.map((error) => ({ offset: error.offset, length: error.length })),
  }
}

export function isKeyword(text: string): boolean {
  return keywordWords.has(text.trim().toLowerCase())
}

export function unquote(image: string): string {
  return image.slice(1, -1).replace(/\\(.)/g, '$1')
}
