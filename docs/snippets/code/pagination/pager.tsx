import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState } from 'tally-react'

export function PageInfo({ grid }: { grid: Grid }): ReactNode {
  const page = useGridState(grid, (state) => state.page)
  const matched = useGridState(grid, (state) => state.matched ?? state.total ?? 0)
  const pages = Math.max(1, Math.ceil(matched / page.size))
  return (
    <nav aria-label="Pages">
      <button
        type="button"
        disabled={page.index === 0}
        onClick={() => grid.setPage(page.index - 1)}
      >
        Previous
      </button>
      <span>
        {page.index + 1} / {pages}
      </span>
      <button
        type="button"
        disabled={page.index >= pages - 1}
        onClick={() => grid.setPage(page.index + 1)}
      >
        Next
      </button>
    </nav>
  )
}
