import type { ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { Tally, type TallyLabels } from 'tally-react'

const labels: Partial<TallyLabels> = {
  filterPlaceholder: 'Filtern…',
  display: 'Ansicht',
  exportCsv: 'CSV exportieren',
  rows: (count) => `${count.toLocaleString('de-DE')} Zeilen`,
  sorted: (sorts) =>
    sorts.length === 0 ? 'Sortierung entfernt' : `Sortiert nach ${sorts[0]?.column ?? ''}`,
  exportFileName: (name) => `${name ?? 'export'}.csv`,
}

export function Konten({ grid }: { grid: Grid }): ReactNode {
  return <Tally grid={grid} label="Konten" labels={labels} />
}
