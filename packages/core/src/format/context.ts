export interface FormatContext {
  readonly locale: string
  readonly timeZone: string
  readonly numberingSystem: string
}

export const defaultFormatContext: FormatContext = {
  locale: 'en-US',
  timeZone: 'UTC',
  numberingSystem: 'latn',
}

export function createFormatContext(overrides: Partial<FormatContext> = {}): FormatContext {
  return { ...defaultFormatContext, ...overrides }
}
