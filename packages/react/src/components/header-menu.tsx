import { Menu } from '@base-ui/react/menu'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Filter,
  Layers,
  Paintbrush,
  Pin,
  PinOff,
  Sigma,
} from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'
import { columnLabel, isAggregate, type Grid, type LayoutColumn } from 'tally-core'
import { useView } from '../hooks/use-store.ts'
import { useShell } from './context.ts'
import { aggregateLabel } from './format.ts'
import { useLabels } from './labels.ts'
import { RulesPopover } from './rules-popover.tsx'

export interface HeaderMenuProps {
  readonly grid: Grid
  readonly entry: LayoutColumn
  readonly anchor: RefObject<HTMLElement | null>
}

export function HeaderMenu({ grid, entry, anchor }: HeaderMenuProps): ReactNode {
  const labels = useLabels()
  const { root, prefillFilter } = useShell()
  const [rulesOpen, setRulesOpen] = useState(false)
  const ruleCount = useView(
    grid,
    (view) => view.rules.filter((rule) => rule.column === entry.column.id).length,
  )
  const { column } = entry
  const type = grid.schema.typeOf(column)
  const footer = useView(grid, (view) => view.footer[column.id])
  const group = useView(grid, (view) => view.group?.column)
  const label = columnLabel(column)
  const sortable = column.sortable !== false
  const groupable = column.groupable !== false && type.groupable
  const filterable = column.filterable !== false
  const aggregates = type.aggregates
  const setSort = (direction: 'asc' | 'desc'): void =>
    grid.view.setSort([{ column: column.id, direction }])
  const startFilter = (): void => prefillFilter(`${label} `)
  return (
    <>
      <RulesPopover
        grid={grid}
        column={column}
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        anchor={anchor}
      />
      <Menu.Root>
        <Menu.Trigger
          className="tally-header-menu-trigger"
          aria-label={labels.columnMenu(label)}
          title={labels.columnMenu(label)}
        >
          <ChevronDown size={14} aria-hidden />
        </Menu.Trigger>
        <Menu.Portal container={root}>
          <Menu.Positioner
            className="tally-popup-positioner"
            positionMethod="fixed"
            sideOffset={4}
            align="end"
          >
            <Menu.Popup className="tally-popup tally-menu">
              <div className="tally-menu-heading">
                <span className="tally-text">{label}</span>
                <span className="tally-menu-detail">{type.name}</span>
              </div>
              {sortable ? (
                <Menu.Group>
                  <Menu.Item className="tally-popup-item" onClick={() => setSort('asc')}>
                    <ArrowUp size={14} aria-hidden />
                    {labels.sortAscending}
                  </Menu.Item>
                  <Menu.Item className="tally-popup-item" onClick={() => setSort('desc')}>
                    <ArrowDown size={14} aria-hidden />
                    {labels.sortDescending}
                  </Menu.Item>
                </Menu.Group>
              ) : null}
              {groupable || filterable ? <Menu.Separator className="tally-menu-separator" /> : null}
              {groupable ? (
                <Menu.Item
                  className="tally-popup-item"
                  onClick={() => grid.view.setGroup(group === column.id ? undefined : column.id)}
                >
                  <Layers size={14} aria-hidden />
                  {group === column.id ? labels.ungroup : labels.groupBy(label)}
                </Menu.Item>
              ) : null}
              {filterable ? (
                <Menu.Item className="tally-popup-item" onClick={startFilter}>
                  <Filter size={14} aria-hidden />
                  {labels.filterBy(label)}
                </Menu.Item>
              ) : null}
              <Menu.Separator className="tally-menu-separator" />
              <Menu.Item
                className="tally-popup-item"
                onClick={() =>
                  grid.view.pinColumn(column.id, entry.pin === 'left' ? undefined : 'left')
                }
              >
                {entry.pin === 'left' ? (
                  <PinOff size={14} aria-hidden />
                ) : (
                  <Pin size={14} aria-hidden />
                )}
                {entry.pin === 'left' ? labels.unpin : labels.pinLeft}
              </Menu.Item>
              <Menu.Item
                className="tally-popup-item"
                onClick={() =>
                  grid.view.pinColumn(column.id, entry.pin === 'right' ? undefined : 'right')
                }
              >
                {entry.pin === 'right' ? (
                  <PinOff size={14} aria-hidden />
                ) : (
                  <Pin size={14} aria-hidden style={{ scale: '-1 1' }} />
                )}
                {entry.pin === 'right' ? labels.unpin : labels.pinRight}
              </Menu.Item>
              <Menu.Item
                className="tally-popup-item"
                onClick={() => grid.view.setColumnHidden(column.id, true)}
              >
                <EyeOff size={14} aria-hidden />
                {labels.hideColumn}
              </Menu.Item>
              <Menu.Separator className="tally-menu-separator" />
              <Menu.Item className="tally-popup-item" onClick={() => setRulesOpen(true)}>
                <Paintbrush size={14} aria-hidden />
                {labels.formattingRules}
                {ruleCount > 0 ? <span className="tally-menu-detail">{ruleCount}</span> : null}
              </Menu.Item>
              {aggregates.length > 0 ? (
                <>
                  <Menu.Separator className="tally-menu-separator" />
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger className="tally-popup-item">
                      <Sigma size={14} aria-hidden />
                      {labels.footer}
                      <span className="tally-menu-detail">
                        {footer === undefined ? labels.none : aggregateLabel(footer)}
                      </span>
                      <ChevronRight size={14} aria-hidden className="tally-menu-chevron" />
                    </Menu.SubmenuTrigger>
                    <Menu.Portal container={root}>
                      <Menu.Positioner
                        className="tally-popup-positioner"
                        positionMethod="fixed"
                        sideOffset={6}
                      >
                        <Menu.Popup className="tally-popup tally-menu">
                          <Menu.RadioGroup
                            value={footer ?? ''}
                            onValueChange={(value: string) =>
                              grid.view.setFooter(column.id, isAggregate(value) ? value : undefined)
                            }
                          >
                            <Menu.RadioItem className="tally-popup-item" value="">
                              {labels.none}
                              <Menu.RadioItemIndicator className="tally-popup-indicator">
                                <Check size={14} aria-hidden />
                              </Menu.RadioItemIndicator>
                            </Menu.RadioItem>
                            {aggregates.map((fn) => (
                              <Menu.RadioItem key={fn} className="tally-popup-item" value={fn}>
                                {aggregateLabel(fn)}
                                <Menu.RadioItemIndicator className="tally-popup-indicator">
                                  <Check size={14} aria-hidden />
                                </Menu.RadioItemIndicator>
                              </Menu.RadioItem>
                            ))}
                          </Menu.RadioGroup>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  )
}
