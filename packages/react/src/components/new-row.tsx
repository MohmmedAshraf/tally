import { Plus } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { columnLabel, type ColumnLayout, type Grid, type LayoutColumn } from 'tally-core'
import { useShell } from './context.ts'
import { editorFor, type EditorMove } from './editors/editors.tsx'
import { cellStyle, isPinEdge, type PinOffsets } from './geometry.ts'
import type { ColumnWindow } from './row.tsx'
import { useLabels } from './labels.ts'

export interface NewRowProps {
  readonly grid: Grid
  readonly layout: ColumnLayout
  readonly offsets: PinOffsets
  readonly window: ColumnWindow
  readonly onCreated: (rowIndex: number, column: number, move: EditorMove | undefined) => void
  readonly rowIndex?: number | undefined
}

export function NewRow({
  grid,
  layout,
  offsets,
  window,
  onCreated,
  rowIndex,
}: NewRowProps): ReactNode {
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
    const style = cellStyle(entry, offsets)
    const active = editing === entry.index
    return (
      <div
        key={column.id}
        role="gridcell"
        className="tally-cell"
        aria-colindex={entry.index + 2}
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
            cancel: () => {
              setEditing(undefined)
              viewport.current?.focus({ preventScroll: true })
            },
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
    <div
      role="row"
      className="tally-row tally-new-row"
      aria-label={labels.addRow}
      aria-rowindex={rowIndex}
    >
      <div
        role="gridcell"
        className="tally-gutter"
        aria-colindex={1}
        {...(layout.left.length === 0 ? { 'data-pin-edge': '' } : {})}
      >
        <Plus size={14} aria-hidden />
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
