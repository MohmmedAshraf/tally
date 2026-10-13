import { describe, expect, it } from 'vitest'
import { createFormatContext } from './context.ts'
import { numberFormatter, parseNumber } from './number.ts'

describe('parseNumber', () => {
  it.each([
    ['1,234.5', 1234.5],
    ['$5,000', 5000],
    ['-$1,200', -1200],
    ['−42', -42],
    ['+7', 7],
    ['2k', 2000],
    ['1.5M', 1_500_000],
    ['3b', 3e9],
    ['12%', 12],
    ['1e3', 1000],
    ['.5', 0.5],
    [42, 42],
  ])('parses %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected)
  })

  it.each(['', 'abc', '1..2', '2kk', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, {}])(
    'rejects %s',
    (input) => {
      expect(parseNumber(input)).toBeUndefined()
    },
  )
})

describe('numberFormatter', () => {
  it('caches formatters per context and options', () => {
    const context = createFormatContext()
    const first = numberFormatter(context, { style: 'currency', currency: 'USD' })
    const second = numberFormatter(context, { style: 'currency', currency: 'USD' })
    expect(first).toBe(second)
    expect(first.format(1234.5)).toBe('$1,234.50')
  })

  it('uses latin digits for arabic locales by default', () => {
    const context = createFormatContext({ locale: 'ar-EG' })
    expect(numberFormatter(context, {}).format(1234)).toMatch(/1[,.٬]234/)
  })
})
