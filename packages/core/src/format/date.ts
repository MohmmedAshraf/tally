import { Temporal } from 'temporal-polyfill'
import type { FormatContext } from './context.ts'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(input: string): boolean {
  if (!ISO_DATE.test(input)) return false
  try {
    Temporal.PlainDate.from(input)
    return true
  } catch {
    return false
  }
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
  return Temporal.PlainDate.compare(a, b)
}

export function dayNumber(isoDate: string): number {
  return Temporal.PlainDate.from(isoDate).since('1970-01-01', { largestUnit: 'day' }).days
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
