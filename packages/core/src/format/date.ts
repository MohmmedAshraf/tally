import { Temporal } from 'temporal-polyfill'
import type { FormatContext } from './context.ts'

function digits(input: string, start: number, end: number): number {
  let value = 0
  for (let index = start; index < end; index += 1) {
    const code = input.charCodeAt(index) - 48
    if (code < 0 || code > 9) return Number.NaN
    value = value * 10 + code
  }
  return value
}

function epochDay(input: string): number | undefined {
  if (input.length !== 10 || input[4] !== '-' || input[7] !== '-') return undefined
  const year = digits(input, 0, 4)
  const month = digits(input, 5, 7)
  const day = digits(input, 8, 10)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const length =
    month === 2
      ? leap
        ? 29
        : 28
      : month === 4 || month === 6 || month === 9 || month === 11
        ? 30
        : 31
  if (!(year >= 0 && month >= 1 && month <= 12 && day >= 1 && day <= length)) return undefined
  const shifted = month <= 2 ? year - 1 : year
  const era = Math.floor(shifted / 400)
  const yearOfEra = shifted - era * 400
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146_097 + dayOfEra - 719_468
}

export function isIsoDate(input: string): boolean {
  return epochDay(input) !== undefined
}

export function parseIsoDate(input: unknown): string | undefined {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? undefined : input.toISOString().slice(0, 10)
  }
  if (typeof input !== 'string') return undefined
  const text = input.trim()
  if (isIsoDate(text)) return text
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(text)
  if (match !== null && isIsoDate(text.slice(0, 10))) return text.slice(0, 10)
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return undefined
  return Temporal.PlainDate.from({
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  }).toString()
}

export function today(context: FormatContext): string {
  return Temporal.Now.plainDateISO(context.timeZone).toString()
}

export function addDays(isoDate: string, days: number): string {
  return Temporal.PlainDate.from(isoDate).add({ days }).toString()
}

export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function dayNumber(isoDate: string): number {
  const day = epochDay(isoDate)
  if (day === undefined) throw new RangeError(isoDate)
  return day
}

export function dateFromDayNumber(day: number): string {
  return Temporal.PlainDate.from('1970-01-01').add({ days: day }).toString()
}

const cache = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(
  context: FormatContext,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${context.locale}|${context.numberingSystem}|${JSON.stringify(options)}`
  let formatter = cache.get(key)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(context.locale, {
      ...options,
      timeZone: 'UTC',
      numberingSystem: context.numberingSystem,
    })
    cache.set(key, formatter)
  }
  return formatter
}

export function formatIsoDate(
  isoDate: string,
  context: FormatContext,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const date = Temporal.PlainDate.from(isoDate)
  return dateFormatter(context, options).format(
    new Date(Date.UTC(date.year, date.month - 1, date.day)),
  )
}

const relativeCache = new Map<string, Intl.RelativeTimeFormat>()

function relativeFormatter(
  context: FormatContext,
  numeric: Intl.RelativeTimeFormatNumeric,
): Intl.RelativeTimeFormat {
  const key = `${context.locale}|${numeric}`
  let formatter = relativeCache.get(key)
  if (formatter === undefined) {
    formatter = new Intl.RelativeTimeFormat(context.locale, { numeric, style: 'short' })
    relativeCache.set(key, formatter)
  }
  return formatter
}

export function formatRelativeDate(
  isoDate: string,
  todayIso: string,
  context: FormatContext,
): string {
  const days = dayNumber(isoDate) - dayNumber(todayIso)
  if (Math.abs(days) < 60) return relativeFormatter(context, 'auto').format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 24) return relativeFormatter(context, 'always').format(months, 'month')
  return relativeFormatter(context, 'always').format(Math.round(days / 365), 'year')
}

export type RelativeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface RelativeRange {
  readonly direction: 'last' | 'next' | 'this'
  readonly amount: number
  readonly unit: RelativeUnit
  readonly shift?: number | undefined
}

export interface DateRange {
  readonly start: string
  readonly end: string
}

const START_OF_UNIT: Readonly<
  Record<RelativeUnit, (date: Temporal.PlainDate) => Temporal.PlainDate>
> = {
  day: (date) => date,
  week: (date) => date.subtract({ days: date.dayOfWeek - 1 }),
  month: (date) => date.with({ day: 1 }),
  quarter: (date) => date.with({ month: Math.floor((date.month - 1) / 3) * 3 + 1, day: 1 }),
  year: (date) => date.with({ month: 1, day: 1 }),
}

const DURATION_OF: Readonly<Record<RelativeUnit, (amount: number) => Temporal.DurationLike>> = {
  day: (amount) => ({ days: amount }),
  week: (amount) => ({ weeks: amount }),
  month: (amount) => ({ months: amount }),
  quarter: (amount) => ({ months: amount * 3 }),
  year: (amount) => ({ years: amount }),
}

export function isRelativeRange(value: unknown): value is RelativeRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'direction' in value &&
    'unit' in value &&
    'amount' in value
  )
}

export function resolveRelativeRange(range: RelativeRange, todayIso: string): DateRange {
  const now = Temporal.PlainDate.from(todayIso)
  if (range.direction === 'this') {
    const start = START_OF_UNIT[range.unit](now).add(DURATION_OF[range.unit](range.shift ?? 0))
    const end = start.add(DURATION_OF[range.unit](1)).subtract({ days: 1 })
    return { start: start.toString(), end: end.toString() }
  }
  const span = DURATION_OF[range.unit](range.amount)
  if (range.direction === 'last') {
    return { start: now.subtract(span).toString(), end: now.toString() }
  }
  return { start: now.toString(), end: now.add(span).toString() }
}
