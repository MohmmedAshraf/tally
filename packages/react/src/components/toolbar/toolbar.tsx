import { Redo2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState, useRows, useSelection } from '../../hooks/use-store.ts'
import { useLabels } from '../labels.ts'
import { DisplayMenu } from './display-menu.tsx'
import { FilterBar, type AskHandler } from './filter-bar.tsx'

export interface ToolbarProps {
  readonly grid: Grid
  readonly ask?: AskHandler | undefined
  readonly children?: ReactNode
}

export function Toolbar({ grid, ask, children }: ToolbarProps): ReactNode {
  const labels = useLabels()
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  const selected = useSelection(grid).rows.size
  const rows = useRows(grid)
  const history = grid.rows.history()
  const position = grid.rows.position()
  const undoEntry = position > 0 ? history[position - 1] : undefined
  const redoEntry = history[position]
  return (
    <div className="tally-toolbar" data-version={rows.version}>
      <FilterBar grid={grid} ask={ask} />
      <span className="tally-count" aria-live="polite">
        {selected > 0
          ? labels.selected(selected)
          : matched === undefined
            ? ''
            : labels.rows(matched)}
      </span>
      {grid.capabilities.mutate ? (
        <span className="tally-toolbar-group">
          <button
            type="button"
            className="tally-icon-button"
            aria-label={undoEntry === undefined ? labels.undo : `${labels.undo} ${undoEntry.label}`}
            title={undoEntry === undefined ? labels.undo : `${labels.undo} ${undoEntry.label}`}
            disabled={undoEntry === undefined}
            onClick={() => void grid.undo()}
          >
            <Undo2 size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="tally-icon-button"
            aria-label={redoEntry === undefined ? labels.redo : `${labels.redo} ${redoEntry.label}`}
            title={redoEntry === undefined ? labels.redo : `${labels.redo} ${redoEntry.label}`}
            disabled={redoEntry === undefined}
            onClick={() => void grid.redo()}
          >
            <Redo2 size={15} aria-hidden />
          </button>
        </span>
      ) : null}
      <DisplayMenu grid={grid} />
      {children}
    </div>
  )
}
