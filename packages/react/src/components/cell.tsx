import { ChevronRight } from 'lucide-react'
import { createElement, memo, type NamedExoticComponent, type ReactNode } from 'react'
import {
  isEmptyValue,
  type FormatRule,
  type Grid,
  type LayoutColumn,
  type RowItem,
} from 'tally-core'
import { AiCell } from './cells/ai-cell.tsx'
import { rendererFor, signOf } from './cells/renderers.tsx'
import { useShell } from './context.ts'
import { cellStyle, type PinOffsets } from './geometry.ts'
import { useLabels } from './labels.ts'

export interface CellViewProps {
  readonly id: string
  readonly grid: Grid
  readonly item: RowItem
  readonly entry: LayoutColumn
  readonly offsets: PinOffsets
  readonly pinEdge: boolean
  readonly treeColumn: boolean
  readonly rule: FormatRule | undefined
  readonly active: boolean
  readonly inRange: boolean
  readonly inFill: boolean
  readonly handle: boolean
  readonly editor: ReactNode
}

export const CellView: NamedExoticComponent<CellViewProps> = memo(function CellView({
  id,
  grid,
  item,
  entry,
  offsets,
  pinEdge,
  treeColumn,
  rule,
  active,
  inRange,
  inFill,
  handle,
  editor,
}: CellViewProps): ReactNode {
  const { renderers, entering } = useShell()
  const labels = useLabels()
  const { column } = entry
  const type = grid.schema.typeOf(column)
  const value = grid.schema.valueOf(item.row, column)
  const text =
    isEmptyValue(value) || !type.is(value) ? '' : type.format(value, column, grid.context.format)
  const renderer = rendererFor(renderers, type)
  const align = column.align ?? type.align
  const style = cellStyle(entry, offsets)
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
      {...(column.ai === true ? { 'data-ai': '' } : {})}
      {...(entering === column.id ? { 'data-entering': '' } : {})}
    >
      {treeColumn && item.hasChildren ? (
        <button
          type="button"
          className="tally-expander"
          tabIndex={-1}
          aria-label={labels.toggleRow}
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
        (column.ai === true ? (
          <AiCell pending={value === undefined} text={text} index={item.index}>
            {createElement(renderer, {
              value,
              text,
              row: item.row,
              column,
              type,
              format: grid.context.format,
            })}
          </AiCell>
        ) : (
          createElement(renderer, {
            value,
            text,
            row: item.row,
            column,
            type,
            format: grid.context.format,
          })
        ))}
      {handle ? <span className="tally-fill-handle" data-fill-handle aria-hidden /> : null}
    </div>
  )
})
