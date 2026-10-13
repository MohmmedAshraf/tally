import { ChevronRight } from 'lucide-react'
import { createElement, type CSSProperties, type ReactNode } from 'react'
import {
  isEmptyValue,
  type FormatRule,
  type Grid,
  type LayoutColumn,
  type RowItem,
} from 'tally-core'
import { rendererFor } from './cells/renderers.tsx'
import { useShell } from './context.ts'

export interface CellViewProps {
  readonly id: string
  readonly grid: Grid
  readonly item: RowItem
  readonly entry: LayoutColumn
  readonly pinOffset: number | undefined
  readonly pinEdge: boolean
  readonly treeColumn: boolean
  readonly rule: FormatRule | undefined
  readonly active: boolean
  readonly inRange: boolean
  readonly inFill: boolean
  readonly handle: boolean
  readonly editor: ReactNode
}

function signOf(type: string, value: unknown): 'up' | 'down' | undefined {
  if (type !== 'percent' || typeof value !== 'number' || value === 0) return undefined
  return value > 0 ? 'up' : 'down'
}

export function CellView({
  id,
  grid,
  item,
  entry,
  pinOffset,
  pinEdge,
  treeColumn,
  rule,
  active,
  inRange,
  inFill,
  handle,
  editor,
}: CellViewProps): ReactNode {
  const { renderers } = useShell()
  const { column } = entry
  const type = grid.schema.typeOf(column)
  const value = grid.schema.valueOf(item.row, column)
  const text =
    isEmptyValue(value) || !type.is(value) ? '' : type.format(value, column, grid.context.format)
  const renderer = rendererFor(renderers, type)
  const align = column.align ?? type.align
  const style: CSSProperties = { width: entry.width }
  if (pinOffset !== undefined) style['--tally-pin-offset'] = `${pinOffset}px`
  if (rule?.style.background !== undefined) style['--tally-rule-background'] = rule.style.background
  if (rule?.style.color !== undefined) style['--tally-rule-color'] = rule.style.color
  if (treeColumn) style.paddingInlineStart = 12 + item.depth * 18
  const sign = signOf(type.name, value)
  return (
    <div
      id={id}
      role="gridcell"
      className="tally-cell"
      aria-colindex={entry.index + 2}
      aria-selected={inRange}
      data-column={column.id}
      data-row-index={item.index}
      data-col-index={entry.index}
      data-align={align}
      style={style}
      {...(entry.pin === undefined ? {} : { 'data-pin': entry.pin })}
      {...(pinEdge ? { 'data-pin-edge': '' } : {})}
      {...(active ? { 'data-active': '' } : {})}
      {...(inRange ? { 'data-range': '' } : {})}
      {...(inFill ? { 'data-fill': '' } : {})}
      {...(editor === null ? {} : { 'data-editing': '' })}
      {...(sign === undefined ? {} : { 'data-sign': sign })}
      {...(rule === undefined ? {} : { 'data-rule': '' })}
      {...(rule?.style.bold === true ? { 'data-bold': '' } : {})}
      {...(rule?.style.italic === true ? { 'data-italic': '' } : {})}
      {...(rule?.style.strike === true ? { 'data-strike': '' } : {})}
    >
      {treeColumn && item.hasChildren ? (
        <button
          type="button"
          className="tally-expander"
          aria-expanded={item.expanded}
          onClick={() => grid.view.setExpanded(item.key, !item.expanded)}
          {...(item.expanded ? { 'data-open': '' } : {})}
        >
          <ChevronRight size={14} aria-hidden />
        </button>
      ) : treeColumn ? (
        <span className="tally-expander" aria-hidden />
      ) : null}
      {editor ??
        createElement(renderer, {
          value,
          text,
          row: item.row,
          column,
          type,
          format: grid.context.format,
        })}
      {handle ? <span className="tally-fill-handle" data-fill-handle aria-hidden /> : null}
    </div>
  )
}
