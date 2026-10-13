import { describe, expect, it } from 'vitest'
import { createFormatContext } from './context.ts'
import {
  addDays,
  compareIsoDates,
  dateFromDayNumber,
  dayNumber,
  formatIsoDate,
  formatRelativeDate,
  isIsoDate,
  parseIsoDate,
  resolveRelativeRange,
  today,
} from './date.ts'

describe('isIsoDate', () => {
  it('accepts calendar dates and rejects impossible ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-2-3')).toBe(false)
  })
})

describe('parseIsoDate', () => {
  it.each([
    ['2026-10-13', '2026-10-13'],
    [' 2026-10-13 ', '2026-10-13'],
    ['2026-10-13T08:30:00Z', '2026-10-13'],
    ['Oct 13, 2026', '2026-10-13'],
    [new Date(Date.UTC(2026, 9, 13)), '2026-10-13'],
  ])('parses %s', (input, expected) => {
    expect(parseIsoDate(input)).toBe(expected)
  })

  it.each(['', 'soon', 42, null, new Date('invalid')])('rejects %s', (input) => {
    expect(parseIsoDate(input)).toBeUndefined()
  })
})

describe('day arithmetic', () => {
  it('round-trips day numbers', () => {
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dateFromDayNumber(dayNumber('2026-10-13'))).toBe('2026-10-13')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('compares dates', () => {
    expect(compareIsoDates('2026-01-01', '2026-01-02')).toBe(-1)
    expect(compareIsoDates('2026-01-02', '2026-01-02')).toBe(0)
  })

  it('returns an iso date for today', () => {
    expect(today(createFormatContext())).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('describes dates relative to today in days, months and years', () => {
    const context = createFormatContext()
    expect(formatRelativeDate('2026-10-13', '2026-10-13', context)).toBe('today')
    expect(formatRelativeDate('2026-10-30', '2026-10-13', context)).toBe('in 17 days')
    expect(formatRelativeDate('2027-03-19', '2026-10-13', context)).toBe('in 5 mo.')
    expect(formatRelativeDate('2026-07-01', '2026-10-13', context)).toBe('3 mo. ago')
    expect(formatRelativeDate('2027-10-13', '2026-10-13', context)).toBe('in 12 mo.')
    expect(formatRelativeDate('2029-01-01', '2026-10-13', context)).toBe('in 2 yr.')
  })
})

describe('formatIsoDate', () => {
  it('formats with the locale', () => {
    expect(formatIsoDate('2026-10-13', createFormatContext())).toBe('Oct 13, 2026')
    expect(formatIsoDate('2026-10-13', createFormatContext({ locale: 'de-DE' }))).toBe(
      '13. Okt. 2026',
    )
  })
})

describe('resolveRelativeRange', () => {
  const now = '2026-10-13'

  it('resolves last and next spans', () => {
    expect(resolveRelativeRange({ direction: 'last', amount: 30, unit: 'day' }, now)).toEqual({
      start: '2026-09-13',
      end: '2026-10-13',
    })
    expect(resolveRelativeRange({ direction: 'next', amount: 2, unit: 'week' }, now)).toEqual({
      start: '2026-10-13',
      end: '2026-10-27',
    })
    expect(resolveRelativeRange({ direction: 'last', amount: 1, unit: 'quarter' }, now)).toEqual({
      start: '2026-07-13',
      end: '2026-10-13',
    })
  })

  it('resolves calendar periods', () => {
    expect(resolveRelativeRange({ direction: 'this', amount: 1, unit: 'week' }, now)).toEqual({
      start: '2026-10-12',
      end: '2026-10-18',
    })
    expect(resolveRelativeRange({ direction: 'this', amount: 1, unit: 'month' }, now)).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    })
    expect(resolveRelativeRange({ direction: 'this', amount: 1, unit: 'quarter' }, now)).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    })
    expect(resolveRelativeRange({ direction: 'this', amount: 1, unit: 'year' }, now)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
    expect(
      resolveRelativeRange({ direction: 'this', amount: 1, unit: 'month', shift: -1 }, now),
    ).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(
      resolveRelativeRange({ direction: 'this', amount: 1, unit: 'day', shift: 1 }, now),
    ).toEqual({ start: '2026-10-14', end: '2026-10-14' })
  })
})
