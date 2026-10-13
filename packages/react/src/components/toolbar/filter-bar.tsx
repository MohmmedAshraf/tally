import { Autocomplete } from '@base-ui/react/autocomplete'
import { Sparkles, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  and,
  describeFilter,
  parseQuery,
  printQuery,
  suggest,
  topLevelClauses,
  type Filter,
  type Grid,
  type Query,
  type Suggestion,
} from 'tally-core'
import { useGridState, useView } from '../../hooks/use-store.ts'
import { useShell } from '../context.ts'
import { useLabels } from '../labels.ts'
import { ClausePopover } from './clause-popover.tsx'

export interface AskResult {
  readonly query: Query
  readonly explanation?: string | undefined
}

export type AskHandler = (question: string, grid: Grid) => Promise<AskResult>

interface Completion {
  readonly suggestion: Suggestion
  readonly text: string
}

function applySuggestion(text: string, suggestion: Suggestion): string {
  const head = text.slice(0, suggestion.replace.start)
  const tail = text.slice(suggestion.replace.end)
  return `${head}${suggestion.insert}${tail}`
}

function clauseKeys(clauses: readonly Filter[], grid: Grid): readonly string[] {
  const seen = new Map<string, number>()
  return clauses.map((clause) => {
    const text = describeFilter(clause, grid.schema, grid.context.format).text
    const count = seen.get(text) ?? 0
    seen.set(text, count + 1)
    return count === 0 ? text : `${text} #${count}`
  })
}

function withoutClause(filter: Filter | undefined, index: number): Filter | undefined {
  const clauses = topLevelClauses(filter).filter((_, position) => position !== index)
  return and(...clauses)
}

function withClause(filter: Filter | undefined, index: number, clause: Filter): Filter | undefined {
  const clauses = topLevelClauses(filter).map((existing, position) =>
    position === index ? clause : existing,
  )
  return and(...clauses)
}

export function Chip({
  grid,
  clause,
  onRemove,
  onChange,
}: {
  readonly grid: Grid
  readonly clause: Filter
  readonly onRemove: () => void
  readonly onChange?: ((clause: Filter) => void) | undefined
}): ReactNode {
  const labels = useLabels()
  const description = describeFilter(clause, grid.schema, grid.context.format)
  const label =
    description.column === undefined ? (
      <span className="tally-chip-text">{description.text}</span>
    ) : (
      <>
        <b>{description.column}</b>
        <em>{description.operator}</em>
        {description.value === undefined ? null : (
          <span className="tally-chip-text">{description.value}</span>
        )}
      </>
    )
  return (
    <span className="tally-chip" title={description.text}>
      {onChange === undefined ? (
        <span className="tally-chip-label">{label}</span>
      ) : (
        <ClausePopover grid={grid} clause={clause} onChange={onChange}>
          {label}
        </ClausePopover>
      )}
      <button
        type="button"
        className="tally-chip-remove"
        aria-label={labels.removeFilter(description.text)}
        onClick={onRemove}
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  )
}

export interface FilterBarProps {
  readonly grid: Grid
  readonly ask?: AskHandler | undefined
}

export function FilterBar({ grid, ask }: FilterBarProps): ReactNode {
  const labels = useLabels()
  const { root, filterInput, onPrefillFilter } = useShell()
  const filter = useView(grid, (view) => view.filter)
  const facets = useGridState(grid, (state) => state.facets)
  const [draft, setDraft] = useState('')
  const [textMode, setTextMode] = useState(false)
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState<AskResult | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  useLayoutEffect(
    () =>
      onPrefillFilter((text) => {
        setDraft(text)
        setError(undefined)
        filterInput.current?.focus()
      }),
    [onPrefillFilter, filterInput],
  )
  const clauses = topLevelClauses(filter)
  const keys = clauseKeys(clauses, grid)
  const pendingChips = (
    result: AskResult,
  ): readonly { readonly clause: Filter; readonly key: string; readonly index: number }[] => {
    const list = topLevelClauses(result.query.filter)
    const listKeys = clauseKeys(list, grid)
    return list.map((clause, index) => ({ clause, key: listKeys[index] ?? String(index), index }))
  }
  const askMode = ask !== undefined && (asking || draft.startsWith('?'))
  const asker = askMode ? ask : undefined
  const question = draft.replace(/^\?\s*/, '')

  const completions = useMemo((): Completion[] => {
    if (askMode || draft === '') return []
    return suggest(draft, draft.length, grid.schema, { facets, limit: 8 }).map((suggestion) => ({
      suggestion,
      text: applySuggestion(draft, suggestion),
    }))
  }, [askMode, draft, facets, grid.schema])

  const apply = (query: Query, merge: boolean): void => {
    grid.view.update((view) => ({
      ...view,
      filter: merge ? and(view.filter, query.filter) : query.filter,
      sort: query.sort.length > 0 ? query.sort : merge ? view.sort : [],
      group: query.group ?? (merge ? view.group : undefined),
    }))
  }

  const submit = (): void => {
    if (draft.trim() === '') return
    if (asker !== undefined) {
      setPending(undefined)
      setError(undefined)
      void asker(question, grid)
        .then((result) => setPending(result))
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      return
    }
    const parsed = parseQuery(draft, grid.schema)
    const first = parsed.errors[0]
    if (first !== undefined) {
      setError(first.message)
      return
    }
    apply(parsed.query, !textMode)
    setDraft('')
    setError(undefined)
    setTextMode(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.defaultPrevented) {
      const highlighted = root.current?.querySelector('.tally-popup-item[data-highlighted]')
      if (highlighted === null || highlighted === undefined) {
        event.preventDefault()
        submit()
      }
      return
    }
    if (event.key === 'Escape') {
      if (pending !== undefined) {
        setPending(undefined)
        return
      }
      if (draft !== '' || asking || textMode) {
        event.preventDefault()
        setDraft('')
        setAsking(false)
        setTextMode(false)
        setError(undefined)
        return
      }
      filterInput.current?.blur()
    }
    if (event.key === 'Backspace' && draft === '' && clauses.length > 0 && !textMode) {
      grid.view.setFilter(withoutClause(filter, clauses.length - 1))
    }
  }

  const enterTextMode = (): void => {
    setTextMode(true)
    setDraft(
      printQuery({ filter, sort: grid.view.get().sort, group: grid.view.get().group }, grid.schema),
    )
    filterInput.current?.focus()
  }

  return (
    <div className="tally-filter-bar" data-ask={askMode ? '' : undefined}>
      <div className="tally-filter" data-invalid={error === undefined ? undefined : ''}>
        {askMode ? (
          <span className="tally-mode">
            <i />
            {labels.ask}
          </span>
        ) : null}
        {textMode
          ? null
          : clauses.map((clause, index) => (
              <Chip
                key={keys[index]}
                grid={grid}
                clause={clause}
                onRemove={() => grid.view.setFilter(withoutClause(filter, index))}
                onChange={(next) => grid.view.setFilter(withClause(filter, index, next))}
              />
            ))}
        <Autocomplete.Root<Completion>
          items={completions}
          mode="none"
          value={draft}
          onValueChange={(value) => {
            setDraft(value)
            setError(undefined)
          }}
          itemToStringValue={(item) => item.text}
          open={completions.length > 0}
          onOpenChange={() => undefined}
        >
          <Autocomplete.Input
            ref={filterInput}
            className="tally-filter-input"
            placeholder={askMode ? labels.askPlaceholder : labels.filterPlaceholder}
            aria-label={labels.filter}
            aria-invalid={error !== undefined}
            title={error}
            onKeyDown={onKeyDown}
          />
          <Autocomplete.Portal container={root}>
            <Autocomplete.Positioner
              className="tally-popup-positioner"
              positionMethod="fixed"
              sideOffset={6}
              align="start"
            >
              <Autocomplete.Popup className="tally-popup">
                <Autocomplete.List className="tally-popup-list">
                  {(item: Completion) => (
                    <Autocomplete.Item
                      key={`${item.suggestion.kind}:${item.suggestion.insert}`}
                      value={item}
                      className="tally-popup-item"
                    >
                      <span className="tally-text">{item.suggestion.label}</span>
                      {item.suggestion.detail === undefined ? null : (
                        <span className="tally-popup-detail">{item.suggestion.detail}</span>
                      )}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
        {clauses.length > 0 && !textMode ? (
          <button type="button" className="tally-filter-text-toggle" onClick={enterTextMode}>
            {labels.editAsText}
          </button>
        ) : null}
      </div>
      {ask === undefined ? null : (
        <button
          type="button"
          className="tally-button"
          data-ai=""
          aria-pressed={askMode}
          onClick={() => {
            setAsking((value) => !value)
            filterInput.current?.focus()
          }}
        >
          <Sparkles size={14} aria-hidden />
          {labels.ask}
        </button>
      )}
      {pending === undefined ? null : (
        <div className="tally-ask-panel" role="dialog" aria-label={labels.ask}>
          {pending.explanation === undefined ? null : (
            <p className="tally-ask-explanation">{pending.explanation}</p>
          )}
          <div className="tally-ask-chips">
            {pendingChips(pending).map(({ clause, key, index }) => (
              <Chip
                key={key}
                grid={grid}
                clause={clause}
                onRemove={() =>
                  setPending({
                    ...pending,
                    query: {
                      ...pending.query,
                      filter: withoutClause(pending.query.filter, index),
                    },
                  })
                }
              />
            ))}
          </div>
          <div className="tally-ask-actions">
            <button type="button" className="tally-button" onClick={() => setPending(undefined)}>
              {labels.discard}
            </button>
            <button
              type="button"
              className="tally-button"
              data-primary=""
              onClick={() => {
                apply(pending.query, false)
                setPending(undefined)
                setDraft('')
                setAsking(false)
              }}
            >
              {labels.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
