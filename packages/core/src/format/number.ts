import type { FormatContext } from './context.ts'

const cache = new Map<string, Intl.NumberFormat>()

export function numberFormatter(
  context: FormatContext,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${context.locale}|${context.numberingSystem}|${JSON.stringify(options)}`
  let formatter = cache.get(key)
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(context.locale, {
      ...options,
      numberingSystem: context.numberingSystem,
    })
    cache.set(key, formatter)
  }
  return formatter
}

const MULTIPLIERS: Readonly<Record<string, number>> = { k: 1e3, m: 1e6, b: 1e9 }

export function parseNumber(input: unknown): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined
  if (typeof input !== 'string') return undefined
  let text = input
    .trim()
    .toLowerCase()
    .replace(/[\s,_]/g, '')
    .replace(/^\+/, '')
    .replace(/^[−–]/, '-')
    .replace(/^(-?)[$€£¥₹]/, '$1')
  if (text === '') return undefined
  let multiplier = 1
  if (text.endsWith('%')) text = text.slice(0, -1)
  const suffix = text.at(-1)
  if (suffix !== undefined && suffix in MULTIPLIERS) {
    multiplier = MULTIPLIERS[suffix] ?? 1
    text = text.slice(0, -1)
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/.test(text)) return undefined
  const value = Number(text) * multiplier
  return Number.isFinite(value) ? value : undefined
}
