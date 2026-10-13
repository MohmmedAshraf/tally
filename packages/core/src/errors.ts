export type TallyErrorCode =
  | 'invalid_column'
  | 'unknown_column'
  | 'unknown_type'
  | 'duplicate_type'
  | 'unsupported_operator'
  | 'invalid_value'
  | 'invalid_filter'
  | 'invalid_view'
  | 'invalid_query'

export class TallyError extends Error {
  readonly code: TallyErrorCode
  readonly details: readonly string[]

  constructor(code: TallyErrorCode, message: string, details: readonly string[] = []) {
    super(message)
    this.name = 'TallyError'
    this.code = code
    this.details = details
  }
}
