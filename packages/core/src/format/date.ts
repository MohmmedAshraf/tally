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

function monthLength(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

function daysFromCivil(year: number, month: number, day: number): number {
  const shifted = month <= 2 ? year - 1 : year
  const era = Math.floor(shifted / 400)
  const yearOfEra = shifted - era * 400
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146_097 + dayOfEra - 719_468
}

function civilFromDays(days: number): readonly [year: number, month: number, day: number] {
  const shifted = days + 719_468
  const era = Math.floor(shifted / 146_097)
  const dayOfEra = shifted - era * 146_097
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  )
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9
  return [yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day]
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function isoFromCivil(year: number, month: number, day: number): string {
  const yearText =
    year >= 0 && year <= 9999
      ? String(year).padStart(4, '0')
      : `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(6, '0')}`
  return `${yearText}-${pad(month)}-${pad(day)}`
}

function epochDay(input: string): number | undefined {
  if (input.length !== 10 || input[4] !== '-' || input[7] !== '-') return undefined
  const year = digits(input, 0, 4)
  const month = digits(input, 5, 7)
  const day = digits(input, 8, 10)
  if (!(year >= 0 && month >= 1 && month <= 12 && day >= 1 && day <= monthLength(year, month))) {
    return undefined
  }
  return daysFromCivil(year, month, day)
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
  return isoFromCivil(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
}

const todayFormatters = new Map<string, Intl.DateTimeFormat>()

export function today(context: FormatContext): string {
  let formatter = todayFormatters.get(context.timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone: context.timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    todayFormatters.set(context.timeZone, formatter)
  }
  let year = 0
  let month = 0
  let day = 0
  for (const part of formatter.formatToParts(Date.now())) {
    if (part.type === 'year') year = Number(part.value)
    else if (part.type === 'month') month = Number(part.value)
    else if (part.type === 'day') day = Number(part.value)
  }
  return isoFromCivil(year, month, day)
}

export function addDays(isoDate: string, days: number): string {
  return dateFromDayNumber(dayNumber(isoDate) + days)
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
  const [year, month, dayOfMonth] = civilFromDays(day)
  return isoFromCivil(year, month, dayOfMonth)
}

function mondayOf(day: number): number {
  return day - ((((day + 3) % 7) + 7) % 7)
}

export function startOfIsoWeek(isoDate: string): string {
  return dateFromDayNumber(mondayOf(dayNumber(isoDate)))
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
  return dateFormatter(context, options).format(new Date(dayNumber(isoDate) * 86_400_000))
}

const relativeCache = new Map<string, Intl.RelativeTimeFormat>()

function relativeFormatter(
  context: FormatContext,
  numeric: Intl.RelativeTimeFormatNumeric,
): Intl.RelativeTimeFormat {
  const key = `${context.locale}|${context.numberingSystem}|${numeric}`
  let formatter = relativeCache.get(key)
  if (formatter === undefined) {
    const locale = new Intl.Locale(context.locale, { numberingSystem: context.numberingSystem })
    formatter = new Intl.RelativeTimeFormat(locale.toString(), { numeric, style: 'short' })
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

const MONTHS_IN: Readonly<Record<'month' | 'quarter' | 'year', number>> = {
  month: 1,
  quarter: 3,
  year: 12,
}

function shiftDay(day: number, unit: RelativeUnit, amount: number): number {
  if (unit === 'day') return day + amount
  if (unit === 'week') return day + amount * 7
  const [year, month, dayOfMonth] = civilFromDays(day)
  const total = year * 12 + month - 1 + amount * MONTHS_IN[unit]
  const targetYear = Math.floor(total / 12)
  const targetMonth = total - targetYear * 12 + 1
  return daysFromCivil(
    targetYear,
    targetMonth,
    Math.min(dayOfMonth, monthLength(targetYear, targetMonth)),
  )
}

function startOfUnit(day: number, unit: RelativeUnit): number {
  if (unit === 'day') return day
  if (unit === 'week') return mondayOf(day)
  const [year, month, dayOfMonth] = civilFromDays(day)
  if (unit === 'month') return day - dayOfMonth + 1
  if (unit === 'quarter') return daysFromCivil(year, Math.floor((month - 1) / 3) * 3 + 1, 1)
  return daysFromCivil(year, 1, 1)
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
  const now = dayNumber(todayIso)
  if (range.direction === 'this') {
    const start = shiftDay(startOfUnit(now, range.unit), range.unit, range.shift ?? 0)
    const end = shiftDay(start, range.unit, 1) - 1
    return { start: dateFromDayNumber(start), end: dateFromDayNumber(end) }
  }
  const edge = dateFromDayNumber(
    shiftDay(now, range.unit, range.direction === 'last' ? -range.amount : range.amount),
  )
  return range.direction === 'last'
    ? { start: edge, end: todayIso }
    : { start: todayIso, end: edge }
}
