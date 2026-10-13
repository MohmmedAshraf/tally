import { useEffect, useState } from 'react'
import { createGrid, type Grid, type GridOptions } from 'tally-core'

interface Held {
  readonly grid: Grid
  readonly formatKey: string
}

function formatKeyOf(options: GridOptions): string {
  const format = options.format
  const today = options.today ?? ''
  if (format === undefined) return today
  return `${format.locale}|${format.timeZone}|${format.numberingSystem}|${today}`
}

export function useGrid(options: GridOptions): Grid {
  const [held, setHeld] = useState<Held>(() => ({
    grid: createGrid(options),
    formatKey: formatKeyOf(options),
  }))
  let current = held
  const formatKey = formatKeyOf(options)
  if (held.grid.schema !== options.schema || held.grid.source !== options.source) {
    current = { grid: createGrid(options), formatKey }
    setHeld(current)
  } else if (held.formatKey !== formatKey) {
    current = { grid: createGrid({ ...options, view: held.grid.view.get() }), formatKey }
    setHeld(current)
  }
  const { grid } = current
  useEffect(() => {
    void grid.load()
    return () => grid.dispose()
  }, [grid])
  return grid
}
