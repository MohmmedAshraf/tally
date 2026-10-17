import { Redo2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState, useRows, useSelection } from '../../hooks/use-store.ts'
import { useLabels } from '../labels.ts'
import { useDecoded } from '../motion.ts'
import type { TallyAi } from '../tally.tsx'
import { AiMenu } from './ai-menu.tsx'
import { DisplayMenu } from './display-menu.tsx'
import { FilterBar } from './filter-bar.tsx'
import { Pager } from '../pager.tsx'

export interface ToolbarProps {
  readonly grid: Grid
  readonly ai?: TallyAi | undefined
  readonly start?: ReactNode
  readonly children?: ReactNode
}

export function Toolbar({ grid, ai, start, children }: ToolbarProps): ReactNode {
  const labels = useLabels()
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  const groups = useGridState(grid, (state) => state.groups?.length)
  const page = useGridState(grid, (state) => state.page)
  const paged = grid.capabilities.pagination === 'offset'
  const range = (total: number, label: typeof labels.pageRange): string =>
    label(page.index * page.size + 1, Math.min(total, (page.index + 1) * page.size), total)
  const selected = useSelection(grid).rows.size
  const rows = useRows(grid)
  const history = grid.rows.history()
  const position = grid.rows.position()
  const undoEntry = position > 0 ? history[position - 1] : undefined
  const redoEntry = history[position]
  const count = useDecoded(
    selected > 0
      ? labels.selected(selected)
      : matched === undefined
        ? ''
        : paged && groups !== undefined && groups > 0
          ? range(groups, labels.groupRange)
          : paged && matched > 0
            ? range(matched, labels.pageRange)
            : labels.rows(matched),
  )
  return (
    <div className="tally-toolbar" data-version={rows.version}>
      {start}
      <FilterBar grid={grid} ask={ai?.ask} />
      <span className="tally-count">{count}</span>
      {paged ? <Pager grid={grid} /> : null}
      <span className="tally-toolbar-separator" aria-hidden />
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
      {ai?.addColumn === undefined ? null : (
        <AiMenu grid={grid} addColumn={ai.addColumn} suggestions={ai.suggestions ?? []} />
      )}
      <DisplayMenu grid={grid} />
      {children}
    </div>
  )
}
