import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  findOption,
  isEmptyValue,
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

function Text({ text, column }: CellProps): ReactNode {
  return (
    <span className="tally-text" {...(column.wrap === true ? { 'data-wrap': '' } : {})}>
      {text}
    </span>
  )
}

function Mono({ text }: CellProps): ReactNode {
  return <span className="tally-text tally-mono">{text}</span>
}

function Enum({ value, text, column }: CellProps): ReactNode {
  if (isEmptyValue(value)) return null
  const option = typeof value === 'string' ? findOption(column, value) : undefined
  const color = option?.color
  return (
    <span
      className="tally-pill"
      style={color === undefined ? undefined : { '--tally-pill-color': color }}
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
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10)
  const color = value < 40 ? 'var(--tally-down)' : value < 70 ? 'var(--tally-warn)' : undefined
  return (
    <>
      <span
        className="tally-meter"
        style={color === undefined ? undefined : { '--tally-meter-color': color }}
        aria-hidden
      >
        {Array.from({ length: 10 }, (_, index) => (
          <b key={index} {...(index < filled ? { 'data-on': '' } : {})} />
        ))}
      </span>
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
  date: Mono,
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
