import { Popover } from '@base-ui/react/popover'
import { Plus, X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import {
  OPERATOR_WORDS,
  columnLabel,
  type Column,
  type FormatRule,
  type FormatStyle,
  type Grid,
  type Operator,
} from 'tally-core'
import { useView } from '../hooks/use-store.ts'
import { useShell } from './context.ts'
import { useLabels } from './labels.ts'

export interface RulesPopoverProps {
  readonly grid: Grid
  readonly column: Column
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly anchor: RefObject<HTMLElement | null>
}

export interface RuleTint {
  readonly id: string
  readonly style: FormatStyle
}

export const RULE_TINTS: readonly RuleTint[] = [
  { id: 'red', style: { background: 'var(--tally-down-soft)', color: 'var(--tally-down)' } },
  { id: 'amber', style: { background: 'var(--tally-warn-soft)', color: 'var(--tally-warn-ink)' } },
  { id: 'green', style: { background: 'var(--tally-up-soft)', color: 'var(--tally-up)' } },
  { id: 'bold', style: { bold: true } },
]

const VALUE_OPERATORS: readonly Operator[] = [
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'empty',
  'notEmpty',
]

function needsValue(operator: Operator): boolean {
  return operator !== 'empty' && operator !== 'notEmpty'
}

function rawValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function tintOf(style: FormatStyle): string | undefined {
  return RULE_TINTS.find(
    (tint) => tint.style.background === style.background && tint.style.bold === style.bold,
  )?.id
}

export function RulesPopover({
  grid,
  column,
  open,
  onOpenChange,
  anchor,
}: RulesPopoverProps): ReactNode {
  const labels = useLabels()
  const { root } = useShell()
  const rules = useView(grid, (view) => view.rules)
  const type = grid.schema.typeOf(column)
  const operators = VALUE_OPERATORS.filter((operator) => type.operators.includes(operator))
  const mine = rules.filter((rule) => rule.column === column.id)
  const update = (next: FormatRule): void =>
    grid.view.setRules(rules.map((rule) => (rule.id === next.id ? next : rule)))
  const remove = (id: string): void => grid.view.setRules(rules.filter((rule) => rule.id !== id))
  const add = (): void =>
    grid.view.setRules([
      ...rules,
      {
        id: crypto.randomUUID(),
        column: column.id,
        op: operators[0] ?? 'eq',
        value: '',
        style: RULE_TINTS[0]?.style ?? {},
      },
    ])
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Portal container={root}>
        <Popover.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          anchor={anchor}
          sideOffset={4}
          align="start"
        >
          <Popover.Popup
            className="tally-popup tally-rules-popup"
            aria-label={labels.formattingRules}
          >
            <Popover.Title className="tally-menu-heading">
              {columnLabel(column)}
              <span className="tally-menu-detail">{labels.formattingRules}</span>
            </Popover.Title>
            {mine.map((rule) => (
              <div key={rule.id} className="tally-rule">
                <select
                  className="tally-input tally-select"
                  aria-label={labels.operator}
                  value={rule.op}
                  onChange={(event) => {
                    const op = operators.find((operator) => operator === event.target.value)
                    if (op !== undefined) update({ ...rule, op })
                  }}
                >
                  {operators.map((operator) => (
                    <option key={operator} value={operator}>
                      {OPERATOR_WORDS[operator]}
                    </option>
                  ))}
                </select>
                {needsValue(rule.op) ? (
                  <input
                    className="tally-input"
                    type={type.kind === 'date' ? 'date' : 'text'}
                    inputMode={type.kind === 'number' ? 'decimal' : undefined}
                    aria-label={labels.value}
                    value={rawValue(rule.value)}
                    onChange={(event) => {
                      const text = event.target.value
                      const parsed = text === '' ? '' : (type.parse(text, column) ?? text)
                      update({ ...rule, value: parsed })
                    }}
                  />
                ) : null}
                <div className="tally-tints" role="radiogroup" aria-label={labels.style}>
                  {RULE_TINTS.map((tint) => (
                    <button
                      key={tint.id}
                      type="button"
                      role="radio"
                      className="tally-tint"
                      data-tint={tint.id}
                      aria-checked={tintOf(rule.style) === tint.id}
                      aria-label={tint.id}
                      style={{
                        background: tint.style.background,
                        color: tint.style.color,
                      }}
                      onClick={() => update({ ...rule, style: tint.style })}
                    >
                      {tint.style.bold === true ? 'B' : ''}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="tally-icon-button tally-rule-remove"
                  aria-label={labels.removeRule}
                  onClick={() => remove(rule.id)}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" className="tally-button" onClick={add}>
              <Plus size={14} aria-hidden />
              {labels.addRule}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
