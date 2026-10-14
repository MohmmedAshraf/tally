import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  dayNumber,
  findOption,
  formatRelativeDate,
  isEmptyValue,
  isIsoDate,
  today,
  type Column,
  type ColumnType,
  type FormatContext,
  type RowData,
} from 'tally-core'

export interface CellProps {
  readonly value: unknown
  readonly text: string
  readonly row: RowData
  readonly column: Column
  readonly type: ColumnType
  readonly format: FormatContext
}

export type CellRenderer = (props: CellProps) => ReactNode

export type CellRenderers = Readonly<Record<string, CellRenderer>>

const HUES = [45, 250, 150, 300, 85, 200, 20, 120, 340, 180] as const

function hueOf(text: string): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return HUES[hash % HUES.length] ?? 0
}

function initials(text: string): string {
  return text
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

export function Tile({ text }: { readonly text: string }): ReactNode {
  return (
    <span className="tally-tile" style={{ '--tally-avatar-hue': hueOf(`${text}x`) }} aria-hidden>
      {initials(text)}
    </span>
  )
}

export function subtitleOf(row: RowData, column: Column): string | undefined {
  if (column.subtitle === undefined) return undefined
  const value = row[column.subtitle]
  return isEmptyValue(value) ? undefined : String(value)
}

function seriesOf(row: RowData, column: Column): readonly number[] | undefined {
  if (column.sparkline === undefined) return undefined
  const value = row[column.sparkline]
  if (!Array.isArray(value) || value.length < 2) return undefined
  return value.every((entry) => typeof entry === 'number') ? value : undefined
}

const SPARK_WIDTH = 44
const SPARK_HEIGHT = 16

function sparkPath(values: readonly number[]): string {
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  return values
    .map((entry, index) => {
      const x = ((index / (values.length - 1)) * SPARK_WIDTH).toFixed(1)
      const y = (SPARK_HEIGHT - 1 - ((entry - min) / range) * (SPARK_HEIGHT - 2)).toFixed(1)
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
}

function Spark({
  values,
  sign,
}: {
  readonly values: readonly number[]
  readonly sign?: string | undefined
}): ReactNode {
  return (
    <svg
      className="tally-spark"
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
      {...(sign === undefined ? {} : { 'data-sign': sign })}
    >
      <path
        d={sparkPath(values)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function Text({ text, row, column }: CellProps): ReactNode {
  const subtitle = subtitleOf(row, column)
  const body =
    subtitle === undefined ? (
      <span className="tally-text" {...(column.wrap === true ? { 'data-wrap': '' } : {})}>
        {text}
      </span>
    ) : (
      <span className="tally-stack">
        <span className="tally-text">{text}</span>
        <span className="tally-sub">{subtitle}</span>
      </span>
    )
  if (column.avatar !== true || text === '') return body
  return (
    <>
      <Tile text={text} />
      {body}
    </>
  )
}

function Mono({ value, text, row, column }: CellProps): ReactNode {
  const series = seriesOf(row, column)
  const sign =
    column.format?.signed === true && typeof value === 'number' && value !== 0
      ? value > 0
        ? 'up'
        : 'down'
      : undefined
  return (
    <>
      {series === undefined ? null : <Spark values={series} sign={sign} />}
      <span className="tally-text tally-mono">{text}</span>
    </>
  )
}

function DateCell({ value, text, column, format }: CellProps): ReactNode {
  if (column.relative !== true || typeof value !== 'string' || !isIsoDate(value)) {
    return <span className="tally-text tally-date">{text}</span>
  }
  const now = today(format)
  const days = dayNumber(value) - dayNumber(now)
  return (
    <span className="tally-stack">
      <span className="tally-text tally-date">{text}</span>
      <span className="tally-sub" {...(days >= 0 && days <= 30 ? { 'data-soon': '' } : {})}>
        {formatRelativeDate(value, now, format)}
      </span>
    </span>
  )
}

function Enum({ value, text, column }: CellProps): ReactNode {
  if (isEmptyValue(value)) return null
  const option = typeof value === 'string' ? findOption(column, value) : undefined
  const color = option?.color
  return (
    <span
      className="tally-pill"
      style={color === undefined ? undefined : { '--tally-pill-color': color }}
      {...(color === undefined ? {} : { 'data-color': '' })}
    >
      {color === undefined ? null : <i />}
      <span className="tally-text">{text}</span>
    </span>
  )
}

function Bool({ value }: CellProps): ReactNode {
  if (isEmptyValue(value)) return null
  return value === true ? (
    <span className="tally-bool">
      <Check size={11} strokeWidth={3} aria-hidden />
    </span>
  ) : (
    <span className="tally-bool" data-off="" />
  )
}

function Person({ value, text }: CellProps): ReactNode {
  if (isEmptyValue(value)) return null
  return (
    <>
      <span className="tally-avatar" style={{ '--tally-avatar-hue': hueOf(text) }} aria-hidden>
        {initials(text)}
      </span>
      <span className="tally-text">{text}</span>
    </>
  )
}

function Bar({ value, text }: CellProps): ReactNode {
  if (typeof value !== 'number') return null
  const percent = Math.max(0, Math.min(100, value))
  const color = value < 40 ? 'var(--tally-down)' : value < 70 ? 'var(--tally-warn)' : undefined
  return (
    <>
      <span
        className="tally-meter"
        style={{
          '--tally-meter-value': `${percent}%`,
          ...(color === undefined ? {} : { '--tally-meter-color': color }),
        }}
        aria-hidden
      />
      <span className="tally-text tally-mono">{text}</span>
    </>
  )
}

function Link({ value, text, type }: CellProps): ReactNode {
  if (isEmptyValue(value) || typeof value !== 'string') return null
  const href = type.name === 'email' ? `mailto:${value}` : value
  return (
    <a
      className="tally-link"
      href={href}
      {...(type.name === 'url' ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {text}
    </a>
  )
}

export const defaultRenderers: CellRenderers = {
  text: Text,
  number: Mono,
  date: DateCell,
  boolean: Bool,
  enum: Enum,
  bool: Bool,
  person: Person,
  bar: Bar,
  email: Link,
  url: Link,
}

export function rendererFor(renderers: CellRenderers, type: ColumnType): CellRenderer {
  return renderers[type.name] ?? renderers[type.kind] ?? Text
}

export function signOf(type: string, value: unknown): 'up' | 'down' | undefined {
  if (type !== 'percent' || typeof value !== 'number' || value === 0) return undefined
  return value > 0 ? 'up' : 'down'
}
