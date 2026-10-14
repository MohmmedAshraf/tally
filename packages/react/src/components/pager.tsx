import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState } from '../hooks/use-store.ts'
import { useLabels } from './labels.ts'

export function Pager({ grid }: { readonly grid: Grid }): ReactNode {
  const labels = useLabels()
  const page = useGridState(grid, (state) => state.page)
  const total = useGridState(grid, (state) => state.groups?.length ?? state.matched ?? state.total)
  if (grid.capabilities.pagination !== 'offset' || total === undefined) return null
  const count = Math.max(1, Math.ceil(total / page.size))
  return (
    <nav className="tally-pager" aria-label={labels.pages}>
      <button
        type="button"
        className="tally-icon-button"
        aria-label={labels.previousPage}
        title={labels.previousPage}
        disabled={page.index === 0}
        onClick={() => grid.setPage(page.index - 1)}
      >
        <ChevronLeft size={15} aria-hidden />
      </button>
      <button
        type="button"
        className="tally-icon-button"
        aria-label={labels.nextPage}
        title={labels.nextPage}
        disabled={page.index >= count - 1}
        onClick={() => grid.setPage(page.index + 1)}
      >
        <ChevronRight size={15} aria-hidden />
      </button>
    </nav>
  )
}
