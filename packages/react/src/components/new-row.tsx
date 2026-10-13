import { Plus } from 'lucide-react'
import { createElement, useState, type CSSProperties, type ReactNode } from 'react'
import { columnLabel, type ColumnLayout, type Grid, type LayoutColumn } from 'tally-core'
import { useShell } from './context.ts'
import { editorFor, type EditorMove } from './editors/editors.tsx'
import { isPinEdge, type PinOffsets } from './geometry.ts'
import type { ColumnWindow } from './row.tsx'
import { useLabels } from './labels.ts'

export interface NewRowProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
  readonly onCreated: (rowIndex: number, column: number, move: EditorMove | undefined) => void
}

export function NewRow({ grid, layout, offsets, window, onCreated }: NewRowProps): ReactNode {
  const labels = useLabels()
  const { editors, viewport } = useShell()
  const [editing, setEditing] = useState<number | undefined>(undefined)
  const create = async (
    entry: LayoutColumn,
    value: unknown,
    move: EditorMove | undefined,
  ): Promise<void> => {
    setEditing(undefined)
    viewport.current?.focus({ preventScroll: true })
    if (value === null || value === undefined || value === '') return
    const parsed = grid.schema.typeOf(entry.column).parse(value, entry.column)
    const row = { ...grid.newRow(), [entry.column.id]: parsed ?? value }
    const before = grid.model().rows.length
    await grid.insertRows([row])
    onCreated(before, entry.index, move)
  }
  const cell = (entry: LayoutColumn): ReactNode => {
    const { column } = entry
    const type = grid.schema.typeOf(column)
    const editable = grid.capabilities.mutate && column.editable !== false
    const pinOffset =
      entry.pin === 'left'
        ? offsets.left.get(column.id)
        : entry.pin === 'right'
          ? offsets.right.get(column.id)
          : undefined
    const style: CSSProperties = { width: entry.width }
    if (pinOffset !== undefined) style['--tally-pin-offset'] = `${pinOffset}px`
    const active = editing === entry.index
    return (
      <div
        key={column.id}
        role="gridcell"
        className="tally-cell"
        data-column={column.id}
        data-align={column.align ?? type.align}
        style={style}
        {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
        {...(isPinEdge(entry, layout) ? { 'data-pin-edge': '' } : {})}
        {...(active ? { 'data-editing': '' } : {})}
      >
        {active ? (
          createElement(editorFor(editors, type), {
            value: null,
            initial: undefined,
            column,
            type,
            format: grid.context.format,
            commit: (value, move) => void create(entry, value, move),
            cancel: () => setEditing(undefined),
          })
        ) : editable ? (
          <button
            type="button"
            className="tally-new-cell"
            aria-label={`${labels.addRow}: ${columnLabel(column)}`}
            onClick={() => setEditing(entry.index)}
          >
            <span className="tally-text">{columnLabel(column)}</span>
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <div role="row" className="tally-row tally-new-row" aria-label={labels.addRow}>
      <div
        className="tally-gutter"
        aria-hidden
        {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
      >
        <Plus size={14} />
      </div>
      {layout.left.map(cell)}
      {window.before > 0 ? (
        <div className="tally-spacer" style={{ width: window.before }} aria-hidden />
      ) : null}
      {window.columns.map(cell)}
      {window.after > 0 ? (
        <div className="tally-spacer" style={{ width: window.after }} aria-hidden />
      ) : null}
      {layout.right.map(cell)}
    </div>
  )
}
