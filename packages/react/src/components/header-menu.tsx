import { Menu } from '@base-ui/react/menu'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronRight,
  Ellipsis,
  EyeOff,
  Filter,
  ListPlus,
  MoveHorizontal,
  Paintbrush,
  Pin,
  PinOff,
  Rows2,
  Sigma,
  UnfoldHorizontal,
} from 'lucide-react'
import { useMemo, useState, type ReactNode, type RefObject } from 'react'
import { columnLabel, isAggregate, type Grid, type LayoutColumn } from 'tally-core'
import { useGridState, useView } from '../hooks/use-store.ts'
import { measureColumnWidth } from './autosize.ts'
import { useShell } from './context.ts'
import { aggregateLabel } from './format.ts'
import { useLabels } from './labels.ts'
import { RulesPopover } from './rules-popover.tsx'

export interface HeaderMenuProps {
  readonly grid: Grid
  readonly entry: LayoutColumn
  readonly anchor: RefObject<HTMLElement | null>
  readonly point?: { readonly x: number; readonly y: number } | undefined
  readonly onPointClose?: (() => void) | undefined
}

export function HeaderMenu({
  grid,
  entry,
  anchor,
  point,
  onPointClose,
}: HeaderMenuProps): ReactNode {
  const labels = useLabels()
  const { root, prefillFilter } = useShell()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const pointAnchor = useMemo(
    () =>
      point === undefined
        ? undefined
        : { getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0) },
    [point],
  )
  const onOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next) onPointClose?.()
  }
  const ruleCount = useView(
    grid,
    (view) => view.rules.filter((rule) => rule.column === entry.column.id).length,
  )
  const { column } = entry
  const type = grid.schema.typeOf(column)
  const footer = useView(grid, (view) => view.footer[column.id])
  const group = useView(grid, (view) => view.group?.column)
  const facet = useGridState(grid, (state) => state.facets?.[entry.column.id])
  const unique = facet?.kind === 'terms' ? facet.terms.length : undefined
  const label = columnLabel(column)
  const sortable = column.sortable !== false
  const groupable = column.groupable !== false && type.groupable
  const filterable = column.filterable !== false
  const aggregates = type.aggregates
  const numeric = (column.align ?? type.align) === 'end'
  const setSort = (direction: 'asc' | 'desc'): void =>
    grid.view.setSort([{ column: column.id, direction }])
  const startFilter = (): void => prefillFilter(`${label} `)
  const filling = (entry.state.flex ?? column.flex ?? 0) > 0
  const fitWidth = (): void => {
    const width = root.current === null ? undefined : measureColumnWidth(root.current, column)
    if (width !== undefined) grid.view.resizeColumn(column.id, width)
  }
  return (
    <>
      <RulesPopover
        grid={grid}
        column={column}
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        anchor={anchor}
      />
      <Menu.Root open={open || point !== undefined} onOpenChange={onOpenChange}>
        <Menu.Trigger
          className="tally-header-menu-trigger"
          aria-label={labels.columnMenu(label)}
          title={labels.columnMenu(label)}
        >
          <Ellipsis size={14} aria-hidden />
        </Menu.Trigger>
        <Menu.Portal container={root}>
          <Menu.Positioner
            className="tally-popup-positioner"
            positionMethod="fixed"
            sideOffset={pointAnchor === undefined ? 4 : 0}
            align={pointAnchor === undefined ? 'end' : 'start'}
            anchor={pointAnchor}
          >
            <Menu.Popup className="tally-popup tally-menu tally-column-menu">
              <div className="tally-menu-heading" data-stacked="">
                <span className="tally-text">{label}</span>
                <span className="tally-menu-detail">{labels.typeName(type.name)}</span>
              </div>
              {unique === undefined ? null : (
                <div className="tally-menu-note">{labels.uniqueValues(unique)}</div>
              )}
              <Menu.Separator className="tally-menu-separator" />
              {sortable ? (
                <Menu.Group>
                  <Menu.Item
                    className="tally-popup-item"
                    onClick={() => setSort(numeric ? 'desc' : 'asc')}
                  >
                    {numeric ? (
                      <ArrowDownWideNarrow size={15} strokeWidth={1.7} aria-hidden />
                    ) : (
                      <ArrowUpNarrowWide size={15} strokeWidth={1.7} aria-hidden />
                    )}
                    {numeric ? labels.sortHighLow : labels.sortAZ}
                  </Menu.Item>
                  <Menu.Item
                    className="tally-popup-item"
                    onClick={() => setSort(numeric ? 'asc' : 'desc')}
                  >
                    {numeric ? (
                      <ArrowUpNarrowWide size={15} strokeWidth={1.7} aria-hidden />
                    ) : (
                      <ArrowDownWideNarrow size={15} strokeWidth={1.7} aria-hidden />
                    )}
                    {numeric ? labels.sortLowHigh : labels.sortZA}
                  </Menu.Item>
                  <Menu.Item
                    className="tally-popup-item"
                    onClick={() => grid.view.toggleSort(column.id, true)}
                  >
                    <ListPlus size={15} strokeWidth={1.7} aria-hidden />
                    {labels.addToSort}
                    <span className="tally-menu-kbd">{labels.addToSortHint}</span>
                  </Menu.Item>
                </Menu.Group>
              ) : null}
              {sortable && (groupable || filterable) ? (
                <Menu.Separator className="tally-menu-separator" />
              ) : null}
              {groupable ? (
                <Menu.Item
                  className="tally-popup-item"
                  onClick={() => grid.view.setGroup(group === column.id ? undefined : column.id)}
                >
                  <Rows2 size={15} strokeWidth={1.7} aria-hidden />
                  {group === column.id ? labels.ungroup : labels.groupBy(label)}
                </Menu.Item>
              ) : null}
              {filterable ? (
                <Menu.Item className="tally-popup-item" onClick={startFilter}>
                  <Filter size={15} strokeWidth={1.7} aria-hidden />
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
                  <PinOff size={15} strokeWidth={1.7} aria-hidden />
                ) : (
                  <Pin size={15} strokeWidth={1.7} aria-hidden />
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
                  <PinOff size={15} strokeWidth={1.7} aria-hidden />
                ) : (
                  <Pin size={15} strokeWidth={1.7} aria-hidden style={{ scale: '-1 1' }} />
                )}
                {entry.pin === 'right' ? labels.unpin : labels.pinRight}
              </Menu.Item>
              <Menu.Item className="tally-popup-item" onClick={fitWidth}>
                <MoveHorizontal size={15} strokeWidth={1.7} aria-hidden />
                {labels.fitWidth}
                <span className="tally-menu-kbd">{labels.fitWidthHint}</span>
              </Menu.Item>
              <Menu.CheckboxItem
                className="tally-popup-item"
                checked={filling}
                onCheckedChange={(checked) => grid.view.setColumnFlex(column.id, checked ? 1 : 0)}
              >
                <UnfoldHorizontal size={15} strokeWidth={1.7} aria-hidden />
                {labels.fillWidth}
                <Menu.CheckboxItemIndicator className="tally-popup-indicator">
                  <Check size={14} aria-hidden />
                </Menu.CheckboxItemIndicator>
              </Menu.CheckboxItem>
              <Menu.Item
                className="tally-popup-item"
                onClick={() => grid.view.setColumnHidden(column.id, true)}
              >
                <EyeOff size={15} strokeWidth={1.7} aria-hidden />
                {labels.hideColumn}
              </Menu.Item>
              <Menu.Separator className="tally-menu-separator" />
              <Menu.Item className="tally-popup-item" onClick={() => setRulesOpen(true)}>
                <Paintbrush size={15} strokeWidth={1.7} aria-hidden />
                {labels.formattingRules}
                {ruleCount > 0 ? <span className="tally-menu-detail">{ruleCount}</span> : null}
              </Menu.Item>
              {aggregates.length > 0 ? (
                <>
                  <Menu.Separator className="tally-menu-separator" />
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger className="tally-popup-item">
                      <Sigma size={15} strokeWidth={1.7} aria-hidden />
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
