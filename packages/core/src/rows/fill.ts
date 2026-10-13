import { addDays, dayNumber, isIsoDate } from '../format/date.ts'
import type { ValueKind } from '../types/column-type.ts'
import { isEmptyValue } from '../types/column-type.ts'

function constantStep(values: readonly number[]): number | undefined {
  if (values.length < 2) return undefined
  const step = values[1]! - values[0]!
  for (let index = 2; index < values.length; index += 1) {
    if (values[index]! - values[index - 1]! !== step) return undefined
  }
  return step
}

function numericSeries(source: readonly number[], count: number): number[] | undefined {
  const step = constantStep(source)
  if (step === undefined) return undefined
  const last = source.at(-1)!
  return Array.from({ length: count }, (_, index) => last + step * (index + 1))
}

function dateSeries(source: readonly string[], count: number): string[] | undefined {
  const step = constantStep(source.map(dayNumber))
  if (step === undefined) return undefined
  const last = source.at(-1)!
  return Array.from({ length: count }, (_, index) => addDays(last, step * (index + 1)))
}

export function fillSeries(source: readonly unknown[], count: number, kind: ValueKind): unknown[] {
  if (source.length === 0 || count <= 0) return []
  const present = source.filter((value) => !isEmptyValue(value))
  if (kind === 'number' && present.length === source.length) {
    const numbers = source.filter((value): value is number => typeof value === 'number')
    if (numbers.length === source.length) {
      const series = numericSeries(numbers, count)
      if (series !== undefined) return series
    }
  }
  if (kind === 'date' && present.length === source.length) {
    const dates = source.filter((value): value is string => isIsoDate(value))
    if (dates.length === source.length) {
      const series = dateSeries(dates, count)
      if (series !== undefined) return series
    }
  }
  return Array.from({ length: count }, (_, index) => source[index % source.length])
}
