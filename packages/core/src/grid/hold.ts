import { createGrid, type Grid, type GridOptions } from './grid.ts'

export interface HeldGrid {
  readonly grid: Grid
  readonly formatKey: string
}

function formatKeyOf(options: GridOptions): string {
  const format = options.format
  const today = options.today ?? ''
  if (format === undefined) return today
  return `${format.locale}|${format.timeZone}|${format.numberingSystem}|${today}`
}

export function holdGrid(options: GridOptions, previous?: HeldGrid): HeldGrid {
  const formatKey = formatKeyOf(options)
  if (previous === undefined) return { grid: createGrid(options), formatKey }
  if (
    previous.grid.schema === options.schema &&
    previous.grid.source === options.source &&
    previous.formatKey === formatKey
  ) {
    return previous
  }
  return { grid: createGrid({ ...options, view: previous.grid.view.get() }), formatKey }
}
