import type { Schema } from '../schema/schema.ts'
import type { Query } from './ast.ts'
import { QueryBuilder, type Clause } from './build.ts'
import { tokenize } from './lexer.ts'
import { parseTokens, type ParseErrorPosition } from './parser.ts'

export interface ParseResult {
  readonly text: string
  readonly query: Query
  readonly clauses: readonly Clause[]
  readonly errors: readonly ParseErrorPosition[]
}

export function parseQuery(text: string, schema: Schema): ParseResult {
  const lexed = tokenize(text, schema)
  const parsed = parseTokens(lexed.tokens, text.length)
  const built = new QueryBuilder(schema).build(parsed.cst, text)
  const lexErrors = lexed.errors.map((error) => ({
    message: `Unexpected "${text.slice(error.offset, error.offset + error.length)}"`,
    offset: error.offset,
    length: error.length,
  }))
  const errors = dedupe(
    [...built.errors, ...parsed.errors, ...lexErrors].toSorted((a, b) => a.offset - b.offset),
  )
  return { text, query: built.query, clauses: built.clauses, errors }
}

function dedupe(errors: readonly ParseErrorPosition[]): readonly ParseErrorPosition[] {
  const seen = new Set<number>()
  return errors.filter((error) => {
    if (seen.has(error.offset)) return false
    seen.add(error.offset)
    return true
  })
}
