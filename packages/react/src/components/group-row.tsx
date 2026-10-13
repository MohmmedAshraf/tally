import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { aggregateKey, isEmptyValue, type Grid, type GroupItem } from 'tally-core'
import { aggregateLabel, formatAggregate } from './format.ts'

export interface GroupRowProps {
  readonly grid: Grid
  readonly item: GroupItem
  readonly style?: CSSProperties | undefined
}

export function GroupRow({ grid, item, style }: GroupRowProps): ReactNode {
  const { column } = item
  const type = grid.schema.typeOf(column)
  const label =
    isEmptyValue(item.value) || !type.is(item.value)
      ? 'Empty'
      : type.format(item.value, column, grid.context.format)
  const footer = grid.view.get().footer
  const summaries = Object.entries(footer)
    .map(([id, fn]) => {
      const target = grid.schema.column(id)
      if (target === undefined) return undefined
      const value = item.aggregates[aggregateKey({ column: id, fn })]
      if (value === undefined) return undefined
      return { id, text: `${aggregateLabel(fn)} ${formatAggregate(grid, target, fn, value)}` }
    })
    .filter((entry) => entry !== undefined)
  return (
    <div
      role="row"
      className="tally-group"
      aria-expanded={!item.collapsed}
      data-group={item.key}
      style={style}
    >
      <button
        type="button"
        className="tally-group-toggle"
        aria-label={label}
        aria-expanded={!item.collapsed}
        onClick={() => grid.view.toggleGroupCollapsed(item.key)}
        style={item.collapsed ? undefined : { rotate: '90deg' }}
      >
        <ChevronRight size={14} aria-hidden />
      </button>
      <span className="tally-text">{label}</span>
      <span className="tally-group-count">
        {item.count.toLocaleString(grid.context.format.locale)}
      </span>
      {summaries.length > 0 ? (
        <span className="tally-group-aggregates">
          {summaries.map((entry) => (
            <span key={entry.id}>{entry.text}</span>
          ))}
        </span>
      ) : null}
    </div>
  )
}
