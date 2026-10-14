import type { CSSProperties } from 'react'
import type { ColumnLayout, Density, LayoutColumn } from 'tally-core'

export const GUTTER_WIDTH = 44
export const GROUP_HEIGHT = 44

export const ROW_HEIGHT: Readonly<Record<Density, number>> = {
  compact: 36,
  comfortable: 48,
  spacious: 60,
}

export interface PinOffsets {
  readonly left: ReadonlyMap<string, number>
  readonly right: ReadonlyMap<string, number>
  readonly leftWidth: number
  readonly rightWidth: number
  readonly centerWidth: number
}

export function pinOffsets(layout: ColumnLayout): PinOffsets {
  const left = new Map<string, number>()
  const right = new Map<string, number>()
  let offset = GUTTER_WIDTH
  for (const entry of layout.left) {
    left.set(entry.column.id, offset)
    offset += entry.width
  }
  let trailing = 0
  for (const entry of layout.right.toReversed()) {
    right.set(entry.column.id, trailing)
    trailing += entry.width
  }
  return {
    left,
    right,
    leftWidth: offset - GUTTER_WIDTH,
    rightWidth: trailing,
    centerWidth: layout.center.reduce((sum, entry) => sum + entry.width, 0),
  }
}

export function cellStyle(entry: LayoutColumn, offsets: PinOffsets): CSSProperties {
  const offset =
    entry.pin === 'left'
      ? offsets.left.get(entry.column.id)
      : entry.pin === 'right'
        ? offsets.right.get(entry.column.id)
        : undefined
  return offset === undefined
    ? { width: entry.width }
    : { width: entry.width, '--tally-pin-offset': `${offset}px` }
}

export function isPinEdge(entry: LayoutColumn, layout: ColumnLayout): boolean {
  if (entry.pin === 'left') return layout.left.at(-1) === entry
  if (entry.pin === 'right') return layout.right[0] === entry
  return false
}

export interface ColumnGroupSpan {
  readonly label: string | undefined
  readonly width: number
  readonly key: string
}

export function groupSpans(columns: readonly LayoutColumn[]): readonly ColumnGroupSpan[] {
  const spans: ColumnGroupSpan[] = []
  for (const entry of columns) {
    const label = entry.column.group
    const last = spans.at(-1)
    if (last !== undefined && last.label === label && label !== undefined) {
      spans[spans.length - 1] = { ...last, width: last.width + entry.width }
    } else {
      spans.push({ label, width: entry.width, key: `${entry.column.id}:${label ?? ''}` })
    }
  }
  return spans
}

export function hasColumnGroups(layout: ColumnLayout): boolean {
  return layout.columns.some((entry) => entry.column.group !== undefined)
}

export function hasWrap(layout: ColumnLayout): boolean {
  return layout.columns.some((entry) => entry.column.wrap === true)
}
