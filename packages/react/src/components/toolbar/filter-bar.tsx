import { Autocomplete } from '@base-ui/react/autocomplete'
import { CircleAlert, Search, Sparkles, X } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
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
import { animateDecode, flash } from '../motion.ts'
import { ClausePopover } from './clause-popover.tsx'

export interface AskResult {
  readonly query: Query
}

export type AskHandler = (question: string, grid: Grid) => Promise<AskResult>

interface Completion {
  readonly suggestion: Suggestion
  readonly text: string
}

interface Decoding {
  readonly from: string
  readonly query: Query
}

const SENTENCE_WORDS = 3
const REVEAL_MS = 900

function isSentence(query: Query): boolean {
  const { filter } = query
  return (
    query.sort.length === 0 &&
    query.group === undefined &&
    filter?.type === 'search' &&
    filter.text.trim().split(/\s+/).length >= SENTENCE_WORDS
  )
}

function Decode({
  from,
  to,
  onDone,
}: {
  readonly from: string
  readonly to: string
  readonly onDone: () => void
}): ReactNode {
  const [text, setText] = useState(from)
  const done = useEffectEvent(onDone)
  useEffect(() => animateDecode(from, to, setText, done), [from, to])
  return <span className="tally-decode">{text}</span>
}

function applySuggestion(text: string, suggestion: Suggestion): string {
  const head = text.slice(0, suggestion.replace.start)
  const tail = text.slice(suggestion.replace.end)
  return `${head}${suggestion.insert}${tail}`
}

function clauseKeys(clauses: readonly Filter[], grid: Grid): readonly string[] {
  const seen = new Map<string, number>()
  return clauses.map((clause) => {
    const text =
      clause.type === 'condition'
        ? `column:${clause.column}`
        : describeFilter(clause, grid.schema, grid.context.format).text
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
  const [asking, setAsking] = useState<string | undefined>(undefined)
  const [decoding, setDecoding] = useState<Decoding | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const request = useRef(0)
  const errorId = useId()
  useLayoutEffect(
    () =>
      onPrefillFilter((text) => {
        setDraft(text)
        setError(undefined)
        filterInput.current?.focus()
      }),
    [onPrefillFilter, filterInput],
  )
  const wasAsking = useRef(false)
  useEffect(() => {
    if (asking === undefined && wasAsking.current) filterInput.current?.focus()
    wasAsking.current = asking !== undefined
  }, [asking, filterInput])
  const clauses = topLevelClauses(filter)
  const keys = clauseKeys(clauses, grid)

  const completions = useMemo((): Completion[] => {
    if (draft === '') return []
    return suggest(draft, draft.length, grid.schema, { facets, limit: 8 }).map((suggestion) => ({
      suggestion,
      text: applySuggestion(draft, suggestion),
    }))
  }, [draft, facets, grid.schema])

  const apply = (query: Query, merge: boolean): void => {
    grid.view.update((view) => ({
      ...view,
      filter: merge ? and(view.filter, query.filter) : query.filter,
      sort: query.sort.length > 0 ? query.sort : merge ? view.sort : [],
      group: query.group ?? (merge ? view.group : undefined),
    }))
  }

  const reset = (): void => {
    setDraft('')
    setError(undefined)
    setTextMode(false)
    setAsking(undefined)
    setDecoding(undefined)
  }

  const runAsk = async (asker: AskHandler, question: string): Promise<void> => {
    request.current += 1
    const id = request.current
    setAsking(question)
    setError(undefined)
    try {
      const result = await asker(question, grid)
      if (id === request.current) setDecoding({ from: question, query: result.query })
    } catch (cause: unknown) {
      if (id !== request.current) return
      setError(cause instanceof Error ? cause.message : String(cause))
      setAsking(undefined)
    }
  }

  const finishAsk = (query: Query): void => {
    apply(query, false)
    flash(root.current, 'data-reveal', REVEAL_MS)
    reset()
  }

  const submit = (): void => {
    if (draft.trim() === '') return
    const parsed = parseQuery(draft, grid.schema)
    const first = parsed.errors[0]
    if (ask !== undefined && (first !== undefined || isSentence(parsed.query))) {
      void runAsk(ask, draft.trim())
      return
    }
    if (first !== undefined) {
      setError(first.message)
      return
    }
    apply(parsed.query, !textMode)
    reset()
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
      if (draft !== '' || textMode) {
        event.preventDefault()
        reset()
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
    <div className="tally-filter-bar">
      <div
        className="tally-filter"
        data-invalid={error === undefined ? undefined : ''}
        {...(asking === undefined ? {} : { 'data-ask': '' })}
        {...(decoding === undefined ? {} : { 'data-decoding': '' })}
      >
        {asking === undefined ? (
          <Search size={14} aria-hidden />
        ) : (
          <Sparkles size={14} aria-hidden />
        )}
        {textMode || asking !== undefined
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
        {asking === undefined ? (
          <Autocomplete.Root<Completion>
            items={completions}
            mode="none"
            value={draft}
            onValueChange={(value) => {
              setDraft(value)
              setError(undefined)
            }}
            itemToStringValue={(item) => item.text}
            open={completions.length > 0 && error === undefined}
            onOpenChange={() => undefined}
          >
            <Autocomplete.Input
              ref={filterInput}
              className="tally-filter-input"
              placeholder={ask === undefined ? labels.filterPlaceholder : labels.askPlaceholder}
              aria-label={labels.filter}
              aria-invalid={error !== undefined}
              aria-describedby={error === undefined ? undefined : errorId}
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
        ) : decoding === undefined ? (
          <span className="tally-decode" role="status" aria-label={labels.asking}>
            {asking}
          </span>
        ) : (
          <Decode
            from={decoding.from}
            to={printQuery(decoding.query, grid.schema)}
            onDone={() => finishAsk(decoding.query)}
          />
        )}
        {clauses.length > 0 && !textMode && asking === undefined ? (
          <button type="button" className="tally-filter-text-toggle" onClick={enterTextMode}>
            {labels.editAsText}
          </button>
        ) : null}
      </div>
      {error === undefined ? null : (
        <div id={errorId} className="tally-filter-error" role="alert">
          <CircleAlert size={14} aria-hidden />
          {error}
        </div>
      )}
    </div>
  )
}
