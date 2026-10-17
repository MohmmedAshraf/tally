import { Temporal } from 'temporal-polyfill'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  startOfIsoWeek,
  today,
  type DateRange,
  type RelativeRange,
  type RelativeUnit,
} from './date.ts'

const EPOCH = Temporal.PlainDate.from('1970-01-01')

function eachDay(first: string, last: string, step = 1): string[] {
  const days: string[] = []
  const end = Temporal.PlainDate.from(last)
  for (
    let date = Temporal.PlainDate.from(first);
    Temporal.PlainDate.compare(date, end) <= 0;
    date = date.add({ days: step })
  ) {
    days.push(date.toString())
  }
  return days
}

describe('isIsoDate', () => {
  it('accepts calendar dates and rejects impossible ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-2-3')).toBe(false)
  })

  it('agrees with Temporal on leap years, month lengths and bounds', () => {
    const samples = ['2024-02-29', '2100-02-29', '2000-02-29', '2026-04-31', '2026-13-01']
    for (const sample of [
      ...samples,
      '2026-00-10',
      '2026-01-00',
      '0000-01-01',
      '9999-12-31',
      '2026-1a-01',
      'abcd-01-01',
      '2026/01/01',
    ]) {
      let valid = true
      try {
        Temporal.PlainDate.from(sample)
      } catch {
        valid = false
      }
      expect({ sample, valid: isIsoDate(sample) }).toEqual({ sample, valid })
    }
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

  it('counts days like Temporal across eras and leap days', () => {
    const epoch = Temporal.PlainDate.from('1970-01-01')
    for (let day = -800_000; day <= 2_200_000; day += 997) {
      const iso = epoch.add({ days: day }).toString()
      if (iso.length !== 10) continue
      expect(dayNumber(iso)).toBe(day)
    }
    expect(dayNumber('0000-01-01')).toBe(-719_528)
    expect(() => dayNumber('2026-02-30')).toThrow(RangeError)
  })

  it('turns every day number from 1900 to 2200 into the date Temporal gives', () => {
    const mismatches = eachDay('1900-01-01', '2200-12-31').filter(
      (iso) => dateFromDayNumber(EPOCH.until(Temporal.PlainDate.from(iso)).days) !== iso,
    )
    expect(mismatches).toEqual([])
  })

  it('turns day numbers across eras into the date Temporal gives', () => {
    for (let day = -800_000; day <= 2_200_000; day += 997) {
      expect(dateFromDayNumber(day)).toBe(EPOCH.add({ days: day }).toString())
    }
    for (const day of [-719_529, -719_528, 2_932_896, 2_932_897]) {
      expect(dateFromDayNumber(day)).toBe(EPOCH.add({ days: day }).toString())
    }
  })

  it('adds days like Temporal', () => {
    for (const iso of eachDay('1900-01-01', '2200-12-31', 37)) {
      for (const days of [-400, -31, -1, 0, 1, 29, 366, 1461]) {
        expect(addDays(iso, days)).toBe(Temporal.PlainDate.from(iso).add({ days }).toString())
      }
    }
  })

  it('finds the monday that starts the iso week', () => {
    expect(startOfIsoWeek('2026-10-13')).toBe('2026-10-12')
    expect(startOfIsoWeek('2026-10-12')).toBe('2026-10-12')
    expect(startOfIsoWeek('2026-10-18')).toBe('2026-10-12')
    expect(startOfIsoWeek('2027-01-01')).toBe('2026-12-28')
    expect(startOfIsoWeek('1970-01-01')).toBe('1969-12-29')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('compares dates', () => {
    expect(compareIsoDates('2026-01-01', '2026-01-02')).toBe(-1)
    expect(compareIsoDates('2026-01-02', '2026-01-02')).toBe(0)
    expect(compareIsoDates('2026-12-01', '2026-02-01')).toBe(1)
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

  it('keeps years before 100 instead of mapping them to the 1900s', () => {
    expect(formatIsoDate('0042-06-15', createFormatContext())).toBe('Jun 15, 42')
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

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['2026-10-13T23:30:00Z', 'UTC', '2026-10-13'],
    ['2026-10-13T23:30:00Z', 'Pacific/Kiritimati', '2026-10-14'],
    ['2026-10-13T23:30:00Z', 'Asia/Kolkata', '2026-10-14'],
    ['2026-10-13T23:30:00Z', 'America/Los_Angeles', '2026-10-13'],
    ['2026-10-14T06:30:00Z', 'Pacific/Pago_Pago', '2026-10-13'],
    ['2024-12-31T23:59:59Z', 'Asia/Tokyo', '2025-01-01'],
    ['2025-01-01T00:00:00Z', 'America/New_York', '2024-12-31'],
    ['2024-02-29T12:00:00Z', 'Europe/Berlin', '2024-02-29'],
  ])('reads %s in %s as %s', (instant, timeZone, expected) => {
    vi.useFakeTimers({ now: new Date(instant) })
    expect(today(createFormatContext({ timeZone, locale: 'ar-EG', numberingSystem: 'arab' }))).toBe(
      expected,
    )
    expect(
      Temporal.Instant.fromEpochMilliseconds(Date.now())
        .toZonedDateTimeISO(timeZone)
        .toPlainDate()
        .toString(),
    ).toBe(expected)
  })
})

function temporalDuration(unit: RelativeUnit, amount: number): Temporal.DurationLike {
  if (unit === 'day') return { days: amount }
  if (unit === 'week') return { weeks: amount }
  if (unit === 'month') return { months: amount }
  if (unit === 'quarter') return { months: amount * 3 }
  return { years: amount }
}

function temporalStartOf(date: Temporal.PlainDate, unit: RelativeUnit): Temporal.PlainDate {
  if (unit === 'day') return date
  if (unit === 'week') return date.subtract({ days: date.dayOfWeek - 1 })
  if (unit === 'month') return date.with({ day: 1 })
  if (unit === 'quarter') {
    return date.with({ month: Math.floor((date.month - 1) / 3) * 3 + 1, day: 1 })
  }
  return date.with({ month: 1, day: 1 })
}

function temporalRange(range: RelativeRange, todayIso: string): DateRange {
  const now = Temporal.PlainDate.from(todayIso)
  if (range.direction === 'this') {
    const start = temporalStartOf(now, range.unit).add(
      temporalDuration(range.unit, range.shift ?? 0),
    )
    const end = start.add(temporalDuration(range.unit, 1)).subtract({ days: 1 })
    return { start: start.toString(), end: end.toString() }
  }
  const span = temporalDuration(range.unit, range.amount)
  return range.direction === 'last'
    ? { start: now.subtract(span).toString(), end: now.toString() }
    : { start: now.toString(), end: now.add(span).toString() }
}

const units: readonly RelativeUnit[] = ['day', 'week', 'month', 'quarter', 'year']

function rangeMismatches(
  days: readonly string[],
  rangesOf: (unit: RelativeUnit) => readonly RelativeRange[],
): unknown[] {
  const mismatches: unknown[] = []
  for (const now of days) {
    for (const unit of units) {
      for (const range of rangesOf(unit)) {
        const actual = resolveRelativeRange(range, now)
        const expected = temporalRange(range, now)
        if (actual.start !== expected.start || actual.end !== expected.end) {
          mismatches.push({ range, now, actual, expected })
        }
      }
    }
  }
  return mismatches
}

describe('resolveRelativeRange against Temporal', () => {
  it('matches every day from 2023 to 2028 for every unit, direction and shift', () => {
    const mismatches = rangeMismatches(eachDay('2023-01-01', '2028-12-31'), (unit) => [
      ...[1, 2, 7, 13].flatMap((amount): RelativeRange[] => [
        { direction: 'last', amount, unit },
        { direction: 'next', amount, unit },
      ]),
      ...[-5, -1, 0, 1, 5].map((shift): RelativeRange => ({
        direction: 'this',
        amount: 1,
        unit,
        shift,
      })),
    ])
    expect(mismatches).toEqual([])
  })

  it('matches every eleventh day from 1900 to 2200', () => {
    const mismatches = rangeMismatches(eachDay('1900-01-01', '2200-12-31', 11), (unit) => [
      { direction: 'last', amount: 3, unit },
      { direction: 'next', amount: 3, unit },
      { direction: 'this', amount: 1, unit, shift: -1 },
    ])
    expect(mismatches).toEqual([])
  })

  it.each([
    [{ direction: 'next', amount: 1, unit: 'month' }, '2026-01-31', '2026-01-31', '2026-02-28'],
    [{ direction: 'next', amount: 1, unit: 'month' }, '2024-01-31', '2024-01-31', '2024-02-29'],
    [{ direction: 'last', amount: 1, unit: 'month' }, '2026-03-31', '2026-02-28', '2026-03-31'],
    [{ direction: 'last', amount: 1, unit: 'quarter' }, '2026-05-31', '2026-02-28', '2026-05-31'],
    [{ direction: 'next', amount: 1, unit: 'year' }, '2024-02-29', '2024-02-29', '2025-02-28'],
    [{ direction: 'last', amount: 4, unit: 'year' }, '2024-02-29', '2020-02-29', '2024-02-29'],
    [{ direction: 'last', amount: 100, unit: 'year' }, '2000-02-29', '1900-02-28', '2000-02-29'],
    [{ direction: 'next', amount: 13, unit: 'month' }, '2026-12-31', '2026-12-31', '2028-01-31'],
    [
      { direction: 'this', amount: 1, unit: 'month', shift: 1 },
      '2026-01-31',
      '2026-02-01',
      '2026-02-28',
    ],
    [
      { direction: 'this', amount: 1, unit: 'week', shift: 0 },
      '2027-01-01',
      '2026-12-28',
      '2027-01-03',
    ],
  ] as const)('resolves %o on %s', (range, now, start, end) => {
    expect(resolveRelativeRange(range, now)).toEqual({ start, end })
    expect(temporalRange(range, now)).toEqual({ start, end })
  })
})
