import { Popover } from '@base-ui/react/popover'
import { Switch } from '@base-ui/react/switch'
import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { columnLabel, type Density, type Grid } from 'tally-core'
import { useView } from '../../hooks/use-store.ts'
import { useShell } from '../context.ts'
import { useLabels } from '../labels.ts'

const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious']

export function DisplayMenu({ grid }: { readonly grid: Grid }): ReactNode {
  const labels = useLabels()
  const { root } = useShell()
  const density = useView(grid, (view) => view.density)
  const columns = useView(grid, (view) => view.columns)
  return (
    <Popover.Root>
      <Popover.Trigger className="tally-button" data-outline="" aria-label={labels.display}>
        <SlidersHorizontal size={14} aria-hidden />
        {labels.display}
      </Popover.Trigger>
      <Popover.Portal container={root}>
        <Popover.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          sideOffset={6}
          align="end"
        >
          <Popover.Popup className="tally-popup tally-display" aria-label={labels.display}>
            <div className="tally-menu-label">{labels.density}</div>
            <div className="tally-segmented" role="radiogroup" data-fill="">
              {DENSITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={density === option}
                  className="tally-segment"
                  onClick={() => grid.view.setDensity(option)}
                >
                  {labels.densities[option]}
                </button>
              ))}
            </div>
            <div className="tally-menu-label">{labels.columns}</div>
            <div className="tally-display-columns">
              {columns.map((state) => {
                const column = grid.schema.column(state.id)
                if (column === undefined) return null
                const label = columnLabel(column)
                const pinned = state.pin === 'left'
                return (
                  <div key={state.id} className="tally-display-row">
                    <Switch.Root
                      className="tally-switch"
                      checked={state.hidden !== true}
                      aria-label={label}
                      onCheckedChange={(checked) => grid.view.setColumnHidden(state.id, !checked)}
                    >
                      <Switch.Thumb className="tally-switch-thumb" />
                    </Switch.Root>
                    <span className="tally-text">{label}</span>
                    <button
                      type="button"
                      className="tally-display-pin"
                      aria-pressed={pinned}
                      aria-label={`${pinned ? labels.unpin : labels.pinLeft}: ${label}`}
                      onClick={() => grid.view.pinColumn(state.id, pinned ? undefined : 'left')}
                    >
                      {pinned ? labels.pinned : labels.pin}
                    </button>
                  </div>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
