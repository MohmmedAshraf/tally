import type { Column, PinSide } from '../schema/column.ts'
import type { Schema } from '../schema/schema.ts'
import type { ColumnState, View } from '../view/view.ts'

export const DEFAULT_COLUMN_WIDTH = 160
export const MIN_COLUMN_WIDTH = 48

export interface LayoutColumn {
  readonly column: Column
  readonly state: ColumnState
  readonly width: number
  readonly pin: PinSide | undefined
  readonly index: number
}

export interface ColumnLayout {
  readonly columns: readonly LayoutColumn[]
  readonly left: readonly LayoutColumn[]
  readonly center: readonly LayoutColumn[]
  readonly right: readonly LayoutColumn[]
  readonly totalWidth: number
}

export function clampWidth(column: Column, width: number): number {
  const min = Math.max(MIN_COLUMN_WIDTH, column.minWidth ?? MIN_COLUMN_WIDTH)
  const max = column.maxWidth ?? Number.POSITIVE_INFINITY
  return Math.min(max, Math.max(min, Math.round(width)))
}

function flexOf(entry: Pick<LayoutColumn, 'column' | 'state'>): number {
  return Math.max(0, entry.state.flex ?? entry.column.flex ?? 0)
}

function fillWidths(
  ordered: readonly Omit<LayoutColumn, 'index'>[],
  available: number,
): readonly Omit<LayoutColumn, 'index'>[] {
  const total = ordered.reduce((sum, entry) => sum + entry.width, 0)
  const flexTotal = ordered.reduce((sum, entry) => sum + flexOf(entry), 0)
  let extra = available - total
  if (extra <= 0 || flexTotal === 0) return ordered
  let remaining = flexTotal
  return ordered.map((entry) => {
    const flex = flexOf(entry)
    if (flex === 0) return entry
    const share = Math.round((extra * flex) / remaining)
    const width = clampWidth(entry.column, entry.width + share)
    extra -= width - entry.width
    remaining -= flex
    return { ...entry, width }
  })
}

export function layoutColumns(view: View, schema: Schema, available?: number): ColumnLayout {
  const visible = view.columns.filter((state) => state.hidden !== true)
  let ordered: Array<Omit<LayoutColumn, 'index'>> = []
  for (const state of visible) {
    const column = schema.column(state.id)
    if (column === undefined) continue
    ordered.push({
      column,
      state,
      width: clampWidth(column, state.width ?? column.width ?? DEFAULT_COLUMN_WIDTH),
      pin: state.pin,
    })
  }
  if (available !== undefined) ordered = [...fillWidths(ordered, available)]
  const bySide = (side: PinSide | undefined): typeof ordered =>
    ordered.filter((entry) => entry.pin === side)
  const columns = [...bySide('left'), ...bySide(undefined), ...bySide('right')].map(
    (entry, index) => ({ ...entry, index }),
  )
  return {
    columns,
    left: columns.filter((entry) => entry.pin === 'left'),
    center: columns.filter((entry) => entry.pin === undefined),
    right: columns.filter((entry) => entry.pin === 'right'),
    totalWidth: columns.reduce((sum, entry) => sum + entry.width, 0),
  }
}
