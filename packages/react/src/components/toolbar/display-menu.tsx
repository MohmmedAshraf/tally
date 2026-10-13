import { Menu } from '@base-ui/react/menu'
import { Check, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { columnLabel, type Density, type Grid } from 'tally-core'
import { useView } from '../../hooks/use-store.ts'
import { useShell } from '../context.ts'
import { useLabels } from '../labels.ts'

const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious']

function isDensity(value: string): value is Density {
  return (DENSITIES as readonly string[]).includes(value)
}

export function DisplayMenu({ grid }: { readonly grid: Grid }): ReactNode {
  const labels = useLabels()
  const { root } = useShell()
  const density = useView(grid, (view) => view.density)
  const columns = useView(grid, (view) => view.columns)
  return (
    <Menu.Root>
      <Menu.Trigger className="tally-button" aria-label={labels.display}>
        <SlidersHorizontal size={14} aria-hidden />
        {labels.display}
      </Menu.Trigger>
      <Menu.Portal container={root}>
        <Menu.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          sideOffset={6}
          align="end"
        >
          <Menu.Popup className="tally-popup tally-menu">
            <Menu.RadioGroup
              value={density}
              onValueChange={(value: string) => {
                if (isDensity(value)) grid.view.setDensity(value)
              }}
            >
              <Menu.GroupLabel className="tally-menu-label">{labels.density}</Menu.GroupLabel>
              {DENSITIES.map((option) => (
                <Menu.RadioItem key={option} className="tally-popup-item" value={option}>
                  {labels.densities[option]}
                  <Menu.RadioItemIndicator className="tally-popup-indicator">
                    <Check size={14} aria-hidden />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            <Menu.Separator className="tally-menu-separator" />
            <Menu.Group>
              <Menu.GroupLabel className="tally-menu-label">{labels.columns}</Menu.GroupLabel>
              {columns.map((state) => {
                const column = grid.schema.column(state.id)
                if (column === undefined) return null
                return (
                  <Menu.CheckboxItem
                    key={state.id}
                    className="tally-popup-item"
                    checked={state.hidden !== true}
                    closeOnClick={false}
                    onCheckedChange={(checked) => grid.view.setColumnHidden(state.id, !checked)}
                  >
                    <span className="tally-text">{columnLabel(column)}</span>
                    <Menu.CheckboxItemIndicator className="tally-popup-indicator">
                      <Check size={14} aria-hidden />
                    </Menu.CheckboxItemIndicator>
                  </Menu.CheckboxItem>
                )
              })}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
