import { Popover } from '@base-ui/react/popover'
import { useState, type ReactNode } from 'react'
import {
  OPERATOR_WORDS,
  columnLabel,
  condition,
  isEmptyValue,
  optionLabel,
  parseQuery,
  printFilter,
  type Column,
  type ColumnType,
  type Condition,
  type Facet,
  type Filter,
  type Grid,
  type HistogramFacet,
  type Operator,
  type RelativeRange,
} from 'tally-core'
import { useGridState } from '../../hooks/use-store.ts'
import { useShell } from '../context.ts'
import { useLabels } from '../labels.ts'

export interface ClausePopoverProps {
  readonly grid: Grid
  readonly clause: Filter
  readonly onChange: (clause: Filter) => void
  readonly children: ReactNode
}

const NUMBER_OPERATORS: readonly Operator[] = ['eq', 'gt', 'lt', 'gte', 'lte', 'between', 'empty']
const DATE_OPERATORS: readonly Operator[] = ['eq', 'gt', 'lt', 'between', 'within', 'empty']
const TEXT_OPERATORS: readonly Operator[] = [
  'contains',
  'eq',
  'startsWith',
  'endsWith',
  'neq',
  'empty',
]

const DATE_PRESETS: readonly RelativeRange[] = [
  { direction: 'last', amount: 7, unit: 'day' },
  { direction: 'last', amount: 30, unit: 'day' },
  { direction: 'last', amount: 90, unit: 'day' },
  { direction: 'this', amount: 1, unit: 'month' },
  { direction: 'next', amount: 30, unit: 'day' },
]

function valuesOf(clause: Condition): readonly unknown[] {
  if (Array.isArray(clause.value)) return clause.value as readonly unknown[]
  return isEmptyValue(clause.value) ? [] : [clause.value]
}

function rawText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function rangeOf(clause: Condition): readonly [unknown, unknown] {
  const values = valuesOf(clause)
  return [values[0], values[1]]
}

function OperatorPicker({
  operators,
  value,
  onChange,
}: {
  readonly operators: readonly Operator[]
  readonly value: Operator
  readonly onChange: (operator: Operator) => void
}): ReactNode {
  return (
    <div className="tally-segmented" role="radiogroup">
      {operators.map((operator) => (
        <button
          key={operator}
          type="button"
          role="radio"
          aria-checked={value === operator}
          className="tally-segment"
          onClick={() => onChange(operator)}
        >
          {OPERATOR_WORDS[operator]}
        </button>
      ))}
    </div>
  )
}

function EnumEditor({
  grid,
  column,
  clause,
  facet,
  onChange,
}: {
  readonly grid: Grid
  readonly column: Column
  readonly clause: Condition
  readonly facet: Facet | undefined
  readonly onChange: (clause: Filter) => void
}): ReactNode {
  const labels = useLabels()
  const negated = clause.op === 'neq' || clause.op === 'notIn'
  const selected = new Set(valuesOf(clause).map(String))
  const counts = new Map(
    facet?.kind === 'terms' ? facet.terms.map((term) => [String(term.value), term.count]) : [],
  )
  const options = column.options ?? []
  const emit = (values: readonly string[], negate: boolean): void => {
    if (values.length === 0) onChange(condition(column.id, negate ? 'notEmpty' : 'empty'))
    else if (values.length === 1) onChange(condition(column.id, negate ? 'neq' : 'eq', values[0]))
    else onChange(condition(column.id, negate ? 'notIn' : 'in', values))
  }
  return (
    <>
      <OperatorPicker
        operators={['eq', 'neq']}
        value={negated ? 'neq' : 'eq'}
        onChange={(operator) => emit([...selected], operator === 'neq')}
      />
      <div className="tally-option-list">
        {options.map((option) => {
          const checked = selected.has(option.value)
          const count = counts.get(option.value)
          return (
            <label key={option.value} className="tally-option">
              <input
                type="checkbox"
                className="tally-check"
                checked={checked}
                onChange={() => {
                  const next = new Set(selected)
                  if (checked) next.delete(option.value)
                  else next.add(option.value)
                  emit([...next], negated)
                }}
              />
              {option.color === undefined ? null : (
                <i className="tally-dot" style={{ background: option.color }} />
              )}
              <span className="tally-text">{optionLabel(column, option.value)}</span>
              {count === undefined ? null : (
                <span className="tally-option-count">
                  {count.toLocaleString(grid.context.format.locale)}
                </span>
              )}
            </label>
          )
        })}
      </div>
      <span className="tally-visually-hidden">{labels.filterBy(columnLabel(column))}</span>
    </>
  )
}

function Histogram({
  facet,
  column,
  type,
  grid,
  onPick,
}: {
  readonly facet: HistogramFacet
  readonly column: Column
  readonly type: ColumnType
  readonly grid: Grid
  readonly onPick: (start: unknown, end: unknown) => void
}): ReactNode {
  const max = Math.max(1, ...facet.bins.map((bin) => bin.count))
  const text = (value: unknown): string =>
    type.is(value) ? type.format(value, column, grid.context.format) : rawText(value)
  return (
    <div className="tally-histogram" aria-hidden>
      {facet.bins.map((bin) => (
        <button
          key={rawText(bin.start)}
          type="button"
          className="tally-histogram-bar"
          aria-label={`${text(bin.start)} – ${text(bin.end)} · ${bin.count}`}
          title={`${text(bin.start)} – ${text(bin.end)} · ${bin.count}`}
          style={{ height: `${Math.max(4, (bin.count / max) * 100)}%` }}
          onClick={() => onPick(bin.start, bin.end)}
          {...(bin.count === 0 ? { 'data-empty': '' } : {})}
        />
      ))}
    </div>
  )
}

function ScalarEditor({
  grid,
  column,
  type,
  clause,
  facet,
  operators,
  onChange,
}: {
  readonly grid: Grid
  readonly column: Column
  readonly type: ColumnType
  readonly clause: Condition
  readonly facet: Facet | undefined
  readonly operators: readonly Operator[]
  readonly onChange: (clause: Filter) => void
}): ReactNode {
  const [from, to] = rangeOf(clause)
  const isDate = type.kind === 'date'
  const inputType = isDate ? 'date' : 'text'
  const parse = (text: string): unknown => (text === '' ? undefined : type.parse(text, column))
  const setOperator = (operator: Operator): void => {
    if (operator === 'empty') onChange(condition(column.id, 'empty'))
    else if (operator === 'between') onChange(condition(column.id, 'between', [from, to]))
    else if (operator === 'within') onChange(condition(column.id, 'within', DATE_PRESETS[1]))
    else onChange(condition(column.id, operator, from))
  }
  const setFrom = (text: string): void => {
    const value = parse(text)
    if (clause.op === 'between') onChange(condition(column.id, 'between', [value, to]))
    else onChange(condition(column.id, clause.op, value))
  }
  const setTo = (text: string): void =>
    onChange(condition(column.id, 'between', [from, parse(text)]))
  return (
    <>
      <OperatorPicker operators={operators} value={clause.op} onChange={setOperator} />
      {facet?.kind === 'histogram' ? (
        <Histogram
          facet={facet}
          column={column}
          type={type}
          grid={grid}
          onPick={(start, end) => onChange(condition(column.id, 'between', [start, end]))}
        />
      ) : null}
      {clause.op === 'within' ? (
        <div className="tally-presets">
          {DATE_PRESETS.map((preset) => {
            const text = printFilter(condition(column.id, 'within', preset), grid.schema)
            const active = printFilter(clause, grid.schema) === text
            return (
              <button
                key={text}
                type="button"
                className="tally-preset"
                aria-pressed={active}
                onClick={() => onChange(condition(column.id, 'within', preset))}
              >
                {text.slice(text.indexOf(' in ') + 4)}
              </button>
            )
          })}
        </div>
      ) : clause.op === 'empty' || clause.op === 'notEmpty' ? null : (
        <div className="tally-range">
          <input
            className="tally-input"
            type={inputType}
            inputMode={isDate ? undefined : 'decimal'}
            value={rawText(from)}
            aria-label={OPERATOR_WORDS[clause.op]}
            onChange={(event) => setFrom(event.target.value)}
          />
          {clause.op === 'between' ? (
            <input
              className="tally-input"
              type={inputType}
              inputMode={isDate ? undefined : 'decimal'}
              value={rawText(to)}
              aria-label={OPERATOR_WORDS.lte}
              onChange={(event) => setTo(event.target.value)}
            />
          ) : null}
        </div>
      )}
    </>
  )
}

function TextEditor({
  column,
  clause,
  onChange,
}: {
  readonly column: Column
  readonly clause: Condition
  readonly onChange: (clause: Filter) => void
}): ReactNode {
  const value = isEmptyValue(clause.value) ? '' : String(clause.value)
  return (
    <>
      <OperatorPicker
        operators={TEXT_OPERATORS}
        value={clause.op}
        onChange={(operator) =>
          onChange(
            operator === 'empty'
              ? condition(column.id, 'empty')
              : condition(column.id, operator, value),
          )
        }
      />
      {clause.op === 'empty' || clause.op === 'notEmpty' ? null : (
        <input
          className="tally-input"
          type="text"
          value={value}
          aria-label={OPERATOR_WORDS[clause.op]}
          onChange={(event) => onChange(condition(column.id, clause.op, event.target.value))}
        />
      )}
    </>
  )
}

function RawEditor({
  grid,
  clause,
  onChange,
}: {
  readonly grid: Grid
  readonly clause: Filter
  readonly onChange: (clause: Filter) => void
}): ReactNode {
  const [text, setText] = useState(printFilter(clause, grid.schema))
  const [invalid, setInvalid] = useState(false)
  return (
    <input
      className="tally-input"
      type="text"
      value={text}
      aria-invalid={invalid}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        const parsed = parseQuery(text, grid.schema)
        if (parsed.errors.length > 0 || parsed.query.filter === undefined) {
          setInvalid(true)
          return
        }
        setInvalid(false)
        onChange(parsed.query.filter)
      }}
    />
  )
}

function Body({ grid, clause, onChange }: Omit<ClausePopoverProps, 'children'>): ReactNode {
  const facets = useGridState(grid, (state) => state.facets)
  if (clause.type !== 'condition')
    return <RawEditor grid={grid} clause={clause} onChange={onChange} />
  const column = grid.schema.column(clause.column)
  if (column === undefined) return <RawEditor grid={grid} clause={clause} onChange={onChange} />
  const type = grid.schema.typeOf(column)
  const facet = facets?.[column.id]
  switch (type.kind) {
    case 'enum':
    case 'boolean':
      return (
        <EnumEditor grid={grid} column={column} clause={clause} facet={facet} onChange={onChange} />
      )
    case 'number':
      return (
        <ScalarEditor
          grid={grid}
          column={column}
          type={type}
          clause={clause}
          facet={facet}
          operators={NUMBER_OPERATORS}
          onChange={onChange}
        />
      )
    case 'date':
      return (
        <ScalarEditor
          grid={grid}
          column={column}
          type={type}
          clause={clause}
          facet={facet}
          operators={DATE_OPERATORS}
          onChange={onChange}
        />
      )
    case 'text':
      return <TextEditor column={column} clause={clause} onChange={onChange} />
  }
}

export function ClausePopover({ grid, clause, onChange, children }: ClausePopoverProps): ReactNode {
  const { root } = useShell()
  const title =
    clause.type === 'condition'
      ? columnLabel(grid.schema.column(clause.column) ?? { id: clause.column, type: 'text' })
      : printFilter(clause, grid.schema)
  return (
    <Popover.Root>
      <Popover.Trigger className="tally-chip-label" nativeButton>
        {children}
      </Popover.Trigger>
      <Popover.Portal container={root}>
        <Popover.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          sideOffset={6}
          align="start"
        >
          <Popover.Popup className="tally-popup tally-clause-popup" aria-label={title}>
            <Popover.Title className="tally-menu-heading">{title}</Popover.Title>
            <Body grid={grid} clause={clause} onChange={onChange} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
