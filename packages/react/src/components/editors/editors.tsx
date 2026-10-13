import { Combobox } from '@base-ui/react/combobox'
import { Check } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useShell } from '../context.ts'
import {
  findOption,
  isEmptyValue,
  optionLabel,
  type Column,
  type ColumnType,
  type EnumOption,
  type FormatContext,
} from 'tally-core'

export type EditorMove = 'down' | 'up' | 'right' | 'left'

export interface CellEditorProps {
  readonly value: unknown
  readonly initial: string | undefined
  readonly column: Column
  readonly type: ColumnType
  readonly format: FormatContext
  readonly commit: (value: unknown, move?: EditorMove) => void
  readonly cancel: () => void
}

export type CellEditor = (props: CellEditorProps) => ReactNode

export type CellEditors = Readonly<Record<string, CellEditor>>

function moveFor(event: KeyboardEvent): EditorMove | undefined {
  if (event.key === 'Enter') return event.shiftKey ? 'up' : 'down'
  if (event.key === 'Tab') return event.shiftKey ? 'left' : 'right'
  return undefined
}

function rawText(value: unknown): string {
  return isEmptyValue(value) ? '' : String(value)
}

function useSettled(): { settle(): boolean } {
  const settled = useRef(false)
  return {
    settle: () => {
      if (settled.current) return false
      settled.current = true
      return true
    },
  }
}

function TextEditor({ value, initial, column, type, commit, cancel }: CellEditorProps): ReactNode {
  const [text, setText] = useState(initial ?? rawText(value))
  const done = useSettled()
  const parse = (): unknown => (text.trim() === '' ? null : (type.parse(text, column) ?? text))
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (done.settle()) cancel()
      return
    }
    if (column.wrap === true && event.key === 'Enter' && event.altKey) return
    const move = moveFor(event)
    if (move === undefined) return
    event.preventDefault()
    if (done.settle()) commit(parse(), move)
  }
  const shared = {
    className: 'tally-editor-input',
    value: text,
    autoFocus: true,
    onKeyDown,
    onChange: (event: { target: { value: string } }) => setText(event.target.value),
    onBlur: () => {
      if (done.settle()) commit(parse())
    },
    'aria-label': column.label ?? column.id,
  }
  if (column.wrap === true) return <textarea {...shared} rows={3} />
  return (
    <input
      {...shared}
      type="text"
      inputMode={type.kind === 'number' ? 'decimal' : undefined}
      onFocus={(event) => event.target.select()}
    />
  )
}

function DateEditor({ value, column, commit, cancel }: CellEditorProps): ReactNode {
  const [text, setText] = useState(rawText(value))
  const done = useSettled()
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (done.settle()) cancel()
      return
    }
    const move = moveFor(event)
    if (move === undefined) return
    event.preventDefault()
    if (done.settle()) commit(text === '' ? null : text, move)
  }
  return (
    <input
      className="tally-editor-input"
      type="date"
      value={text}
      autoFocus
      aria-label={column.label ?? column.id}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (done.settle()) commit(text === '' ? null : text)
      }}
    />
  )
}

function EnumEditor({ value, initial, column, commit, cancel }: CellEditorProps): ReactNode {
  const { root } = useShell()
  const done = useSettled()
  const options = column.options ?? []
  const selected = typeof value === 'string' ? (findOption(column, value) ?? null) : null
  const [query, setQuery] = useState(initial ?? '')
  return (
    <Combobox.Root<EnumOption | null>
      items={options}
      defaultOpen
      autoHighlight
      value={selected}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(item) => (item === null ? '' : optionLabel(column, item.value))}
      isItemEqualToValue={(a, b) => a?.value === b?.value}
      onValueChange={(item) => {
        if (done.settle()) commit(item === null ? null : item.value, 'down')
      }}
      onOpenChange={(open, details) => {
        if (open) return
        if (details.reason === 'escape-key' && done.settle()) cancel()
        if (details.reason === 'focus-out' && done.settle()) commit(selected?.value ?? null)
      }}
    >
      <Combobox.Input
        className="tally-editor-input"
        autoFocus
        aria-label={column.label ?? column.id}
        placeholder={selected === null ? undefined : optionLabel(column, selected.value)}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault()
            if (done.settle()) commit(selected?.value ?? null, event.shiftKey ? 'left' : 'right')
          }
        }}
      />
      <Combobox.Portal container={root}>
        <Combobox.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          sideOffset={4}
          align="start"
        >
          <Combobox.Popup className="tally-popup">
            <Combobox.List className="tally-popup-list">
              {(item: EnumOption) => (
                <Combobox.Item key={item.value} value={item} className="tally-popup-item">
                  {item.color === undefined ? null : (
                    <i className="tally-dot" style={{ background: item.color }} />
                  )}
                  <span className="tally-text">{optionLabel(column, item.value)}</span>
                  <Combobox.ItemIndicator className="tally-popup-indicator">
                    <Check size={14} aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

export const defaultEditors: CellEditors = {
  text: TextEditor,
  number: TextEditor,
  date: DateEditor,
  enum: EnumEditor,
}

export function editorFor(editors: CellEditors, type: ColumnType): CellEditor {
  return editors[type.name] ?? editors[type.kind] ?? TextEditor
}
