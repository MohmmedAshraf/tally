import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useGridState } from 'tally-react'

export function PlanCounts({ grid }: { grid: Grid }): ReactNode {
  const facet = useGridState(grid, (state) => state.facets?.['plan'])
  if (facet?.kind !== 'terms') return null
  return (
    <ul>
      {facet.terms.map((term) => (
        <li key={String(term.value)}>
          {String(term.value)}: {term.count}
        </li>
      ))}
    </ul>
  )
}
