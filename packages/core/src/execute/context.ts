import { createFormatContext, type FormatContext } from '../format/context.ts'
import { today } from '../format/date.ts'
import type { RowData } from '../rows/row.ts'

export type FlagResolver = (name: string, row: RowData) => boolean

export interface ExecutionContext {
  readonly format: FormatContext
  readonly today: string
  readonly flags: FlagResolver
}

export interface ExecutionOptions {
  readonly format?: FormatContext | undefined
  readonly today?: string | undefined
  readonly flags?: FlagResolver | undefined
}

export function createExecutionContext(options: ExecutionOptions = {}): ExecutionContext {
  const format = options.format ?? createFormatContext()
  return {
    format,
    today: options.today ?? today(format),
    flags: options.flags ?? (() => false),
  }
}
