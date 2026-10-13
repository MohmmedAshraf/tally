import {
  CstParser,
  EOF,
  tokenMatcher,
  type CstNode,
  type IParserErrorMessageProvider,
  type IToken,
  type ParserMethod,
  type TokenType,
} from 'chevrotain'
import {
  allTokens,
  And,
  Asc,
  Between,
  ColumnRef,
  Comma,
  Contains,
  DateLiteral,
  Desc,
  DotDot,
  Empty,
  EndsWith,
  Flag,
  GroupBy,
  Gt,
  Gte,
  In,
  Is,
  IsNot,
  Last,
  LParen,
  Lt,
  Lte,
  Next,
  Not,
  NotContains,
  NotEmpty,
  NotIn,
  NumberLiteral,
  OperatorToken,
  Or,
  QuotedString,
  RParen,
  SortBy,
  StartsWith,
  Term,
  This,
  To,
  Today,
  Tomorrow,
  Unit,
  Within,
  Yesterday,
} from './lexer.ts'

type Rule = ParserMethod<[], CstNode>

class QueryParser extends CstParser {
  readonly query: Rule = this.RULE('query', () => {
    this.OPTION(() => this.SUBRULE(this.orExpression))
  })

  readonly orExpression: Rule = this.RULE('orExpression', () => {
    this.SUBRULE(this.andExpression)
    this.MANY(() => {
      this.CONSUME(Or)
      this.SUBRULE2(this.andExpression)
    })
  })

  readonly andExpression: Rule = this.RULE('andExpression', () => {
    this.SUBRULE(this.unary)
    this.MANY(() => {
      this.OPTION(() =>
        this.OR([{ ALT: () => this.CONSUME(And) }, { ALT: () => this.CONSUME(Comma) }]),
      )
      this.SUBRULE2(this.unary)
    })
  })

  readonly unary: Rule = this.RULE('unary', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Not)
          this.SUBRULE(this.unary)
        },
      },
      { ALT: () => this.SUBRULE(this.primary) },
    ])
  })

  readonly primary: Rule = this.RULE('primary', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(LParen)
          this.SUBRULE(this.orExpression)
          this.CONSUME(RParen)
        },
      },
      { ALT: () => this.SUBRULE(this.sortDirective) },
      { ALT: () => this.SUBRULE(this.groupDirective) },
      { ALT: () => this.CONSUME(Flag) },
      {
        GATE: () => tokenMatcher(this.LA(1), ColumnRef) && this.startsConditionTail(this.LA(2)),
        ALT: () => this.SUBRULE(this.condition),
      },
      { ALT: () => this.SUBRULE(this.phrase) },
    ])
  })

  readonly sortDirective: Rule = this.RULE('sortDirective', () => {
    this.CONSUME(SortBy)
    this.CONSUME(ColumnRef)
    this.OPTION(() =>
      this.OR([{ ALT: () => this.CONSUME(Asc) }, { ALT: () => this.CONSUME(Desc) }]),
    )
  })

  readonly groupDirective: Rule = this.RULE('groupDirective', () => {
    this.CONSUME(GroupBy)
    this.CONSUME(ColumnRef)
  })

  readonly condition: Rule = this.RULE('condition', () => {
    this.CONSUME(ColumnRef)
    this.OR({
      IGNORE_AMBIGUITIES: true,
      DEF: [
        {
          ALT: () => {
            this.OR2([{ ALT: () => this.CONSUME(IsNot) }, { ALT: () => this.CONSUME(Is) }])
            this.SUBRULE(this.isValue)
          },
        },
        {
          ALT: () => {
            this.OR3([
              { ALT: () => this.CONSUME(Gte) },
              { ALT: () => this.CONSUME(Lte) },
              { ALT: () => this.CONSUME(Gt) },
              { ALT: () => this.CONSUME(Lt) },
            ])
            this.SUBRULE(this.scalar)
          },
        },
        {
          ALT: () => {
            this.OR4([
              { ALT: () => this.CONSUME(NotContains) },
              { ALT: () => this.CONSUME(Contains) },
              { ALT: () => this.CONSUME(StartsWith) },
              { ALT: () => this.CONSUME(EndsWith) },
            ])
            this.SUBRULE2(this.scalar)
          },
        },
        {
          ALT: () => {
            this.OR5([{ ALT: () => this.CONSUME(NotIn) }, { ALT: () => this.CONSUME(In) }])
            this.OR6([
              { ALT: () => this.SUBRULE(this.relative) },
              { ALT: () => this.SUBRULE(this.parenList) },
              { ALT: () => this.SUBRULE(this.valueList) },
            ])
          },
        },
        {
          ALT: () => {
            this.CONSUME(Between)
            this.SUBRULE3(this.scalar)
            this.OR7([{ ALT: () => this.CONSUME(And) }, { ALT: () => this.CONSUME(To) }])
            this.SUBRULE4(this.scalar)
          },
        },
        {
          ALT: () => {
            this.CONSUME(Within)
            this.SUBRULE2(this.relative)
          },
        },
        { ALT: () => this.SUBRULE3(this.relative) },
        {
          GATE: () => this.isRangeJoin(this.LA(2)),
          ALT: () => this.SUBRULE(this.range),
        },
        { ALT: () => this.SUBRULE2(this.valueList) },
      ],
    })
  })

  readonly isValue: Rule = this.RULE('isValue', () => {
    this.OR({
      IGNORE_AMBIGUITIES: true,
      DEF: [
        {
          GATE: () => this.atClauseEnd(this.LA(2)),
          ALT: () => this.CONSUME(NotEmpty),
        },
        {
          GATE: () => this.atClauseEnd(this.LA(2)),
          ALT: () => this.CONSUME(Empty),
        },
        { ALT: () => this.SUBRULE(this.relative) },
        {
          GATE: () => this.isRangeJoin(this.LA(2)),
          ALT: () => this.SUBRULE(this.range),
        },
        { ALT: () => this.SUBRULE(this.valueList) },
      ],
    })
  })

  readonly parenList: Rule = this.RULE('parenList', () => {
    this.CONSUME(LParen)
    this.SUBRULE(this.scalar)
    this.MANY(() => {
      this.OR([{ ALT: () => this.CONSUME(Comma) }, { ALT: () => this.CONSUME(Or) }])
      this.SUBRULE2(this.scalar)
    })
    this.CONSUME(RParen)
  })

  readonly valueList: Rule = this.RULE('valueList', () => {
    this.SUBRULE(this.scalar)
    this.MANY({
      GATE: () =>
        tokenMatcher(this.LA(1), Or) &&
        this.startsScalar(this.LA(2)) &&
        !this.startsClause(this.LA(2), this.LA(3)),
      DEF: () => {
        this.CONSUME(Or)
        this.SUBRULE2(this.scalar)
      },
    })
  })

  readonly range: Rule = this.RULE('range', () => {
    this.SUBRULE(this.literal)
    this.OR([{ ALT: () => this.CONSUME(DotDot) }, { ALT: () => this.CONSUME(To) }])
    this.SUBRULE2(this.literal)
  })

  readonly literal: Rule = this.RULE('literal', () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(DateLiteral) },
      { ALT: () => this.CONSUME(QuotedString) },
    ])
  })

  readonly scalar: Rule = this.RULE('scalar', () => {
    this.SUBRULE(this.phrase)
  })

  readonly relative: Rule = this.RULE('relative', () => {
    this.OR([
      {
        ALT: () => {
          this.OR2([{ ALT: () => this.CONSUME(Last) }, { ALT: () => this.CONSUME(Next) }])
          this.OPTION(() => this.CONSUME(NumberLiteral))
          this.CONSUME(Unit)
        },
      },
      {
        ALT: () => {
          this.CONSUME(This)
          this.CONSUME2(Unit)
        },
      },
      { ALT: () => this.CONSUME(Today) },
      { ALT: () => this.CONSUME(Yesterday) },
      { ALT: () => this.CONSUME(Tomorrow) },
    ])
  })

  readonly phrase: Rule = this.RULE('phrase', () => {
    this.AT_LEAST_ONE({
      GATE: () => !this.startsClause(this.LA(1), this.LA(2)),
      DEF: () => this.CONSUME(Term),
    })
  })

  constructor() {
    super([...allTokens], {
      maxLookahead: 3,
      recoveryEnabled: true,
      nodeLocationTracking: 'none',
      errorMessageProvider: messages,
    })
    this.performSelfAnalysis()
  }

  private startsConditionTail(token: IToken): boolean {
    return (
      this.isOperator(token) ||
      this.isRelativeStart(token) ||
      (tokenMatcher(token, Term) && !tokenMatcher(token, ColumnRef))
    )
  }

  private atClauseEnd(token: IToken): boolean {
    return this.isOneOf(token, [EOF, And, Or, Comma, RParen, SortBy, GroupBy])
  }

  private startsClause(first: IToken, second: IToken): boolean {
    if (this.isOneOf(first, [SortBy, GroupBy, Flag])) return true
    if (!tokenMatcher(first, ColumnRef)) return false
    return this.isOperator(second) || this.isRelativeStart(second) || this.followedByRange(second)
  }

  private startsScalar(token: IToken): boolean {
    return tokenMatcher(token, Term) && !this.isOperator(token)
  }

  private isOperator(token: IToken): boolean {
    return tokenMatcher(token, OperatorToken)
  }

  private isRelativeStart(token: IToken): boolean {
    return this.isOneOf(token, [Last, Next, This, Today, Yesterday, Tomorrow])
  }

  private isRangeJoin(token: IToken): boolean {
    return this.isOneOf(token, [DotDot, To])
  }

  private followedByRange(token: IToken): boolean {
    return this.isOneOf(token, [NumberLiteral, DateLiteral]) && this.isRangeJoin(this.LA(3))
  }

  private isOneOf(token: IToken, types: readonly TokenType[]): boolean {
    return types.some((type) => tokenMatcher(token, type))
  }
}

const messages: IParserErrorMessageProvider = {
  buildMismatchTokenMessage: ({ expected }) => `Expected ${expected.LABEL ?? expected.name}`,
  buildNotAllInputParsedMessage: ({ firstRedundant }) => `Unexpected "${firstRedundant.image}"`,
  buildNoViableAltMessage: ({ actual }) =>
    actual[0] === undefined || actual[0].tokenType === EOF
      ? 'Expected a value'
      : `Unexpected "${actual[0].image}"`,
  buildEarlyExitMessage: () => 'Expected a value',
}

let instance: QueryParser | undefined

export function queryParser(): QueryParser {
  instance ??= new QueryParser()
  return instance
}

export interface ParseErrorPosition {
  readonly message: string
  readonly offset: number
  readonly length: number
}

export interface CstResult {
  readonly cst: CstNode | undefined
  readonly errors: readonly ParseErrorPosition[]
}

export function parseTokens(tokens: readonly IToken[], inputLength: number): CstResult {
  const parser = queryParser()
  parser.input = [...tokens]
  const cst = parser.query() as CstNode | undefined
  const errors = parser.errors.map((error) => {
    const offset = error.token.tokenType === EOF ? inputLength : error.token.startOffset
    const length = error.token.tokenType === EOF ? 0 : error.token.image.length
    return { message: error.message, offset, length }
  })
  return { cst, errors }
}
