import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState } from '../hooks/use-store.ts'
import { useLabels } from './labels.ts'

type PagerEntry =
  | { readonly kind: 'page'; readonly page: number }
  | { readonly kind: 'gap'; readonly after: number }

function pageWindow(current: number, count: number): readonly PagerEntry[] {
  const pages = new Set<number>([0, count - 1, current - 1, current, current + 1])
  if (count <= 7) for (let page = 0; page < count; page += 1) pages.add(page)
  if (current <= 2) [1, 2, 3].forEach((page) => pages.add(page))
  if (current >= count - 3) [count - 4, count - 3, count - 2].forEach((page) => pages.add(page))
  const sorted = [...pages].filter((page) => page >= 0 && page < count).toSorted((a, b) => a - b)
  const output: PagerEntry[] = []
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous > 1) output.push({ kind: 'gap', after: previous })
    output.push({ kind: 'page', page })
  })
  return output
}

export function Pager({ grid }: { readonly grid: Grid }): ReactNode {
  const labels = useLabels()
  const page = useGridState(grid, (state) => state.page)
  const total = useGridState(grid, (state) => state.matched ?? state.total)
  if (grid.capabilities.pagination !== 'offset' || total === undefined) return null
  const count = Math.max(1, Math.ceil(total / page.size))
  const locale = grid.context.format.locale
  return (
    <nav className="tally-pager" aria-label={labels.pages}>
      <button
        type="button"
        className="tally-icon-button"
        aria-label={labels.previousPage}
        disabled={page.index === 0}
        onClick={() => grid.setPage(page.index - 1)}
      >
        <ChevronLeft size={15} aria-hidden />
      </button>
      {pageWindow(page.index, count).map((entry) =>
        entry.kind === 'gap' ? (
          <span key={`gap-${entry.after}`} className="tally-pager-gap" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={entry.page}
            type="button"
            className="tally-pager-page"
            aria-current={entry.page === page.index ? 'page' : undefined}
            onClick={() => grid.setPage(entry.page)}
          >
            {(entry.page + 1).toLocaleString(locale)}
          </button>
        ),
      )}
      <button
        type="button"
        className="tally-icon-button"
        aria-label={labels.nextPage}
        disabled={page.index >= count - 1}
        onClick={() => grid.setPage(page.index + 1)}
      >
        <ChevronRight size={15} aria-hidden />
      </button>
    </nav>
  )
}
