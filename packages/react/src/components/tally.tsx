import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Columns3, Inbox, RefreshCw, SearchX, CircleAlert } from 'lucide-react'
import { printFilter, type Grid } from 'tally-core'
import { GridProvider } from '../hooks/context.tsx'
import { useColumnLayout, useGridState, useRowModel, useView } from '../hooks/use-store.ts'
import { Body } from './body.tsx'
import { Cards } from './cards.tsx'
import { GUTTER_WIDTH } from './geometry.ts'
import { defaultRenderers, type CellRenderers } from './cells/renderers.tsx'
import { defaultEditors, type CellEditors } from './editors/editors.tsx'
import { ShellContext, useShell, type TallyShell } from './context.ts'
import { LabelsContext, defaultLabels, useLabels, type TallyLabels } from './labels.ts'
import { Toolbar } from './toolbar/toolbar.tsx'
import type { AskHandler } from './toolbar/filter-bar.tsx'
import type { IntentHandler } from './interactions.ts'

export interface TallyProps {
  readonly grid: Grid
  readonly renderers?: CellRenderers | undefined
  readonly editors?: CellEditors | undefined
  readonly theme?: 'light' | 'dark' | undefined
  readonly dir?: 'ltr' | 'rtl' | undefined
  readonly className?: string | undefined
  readonly style?: CSSProperties | undefined
  readonly label?: string | undefined
  readonly initialSize?: { readonly width: number; readonly height: number } | undefined
  readonly onIntent?: IntentHandler | undefined
  readonly labels?: Partial<TallyLabels> | undefined
  readonly toolbar?: ReactNode
  readonly ask?: AskHandler | undefined
  readonly layout?: 'auto' | 'grid' | 'cards' | undefined
  readonly cardsBelow?: number | undefined
  readonly children?: ReactNode
}

function useClientWidth(element: { readonly current: HTMLElement | null }): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const node = element.current
    if (node === null || typeof ResizeObserver === 'undefined') return
    const measure = (): void => setWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [element])
  return width
}

function EmptyState({
  grid,
  columns,
}: {
  readonly grid: Grid
  readonly columns: number
}): ReactNode {
  const labels = useLabels()
  const filter = useView(grid, (view) => view.filter)
  if (columns === 0) {
    return (
      <div className="tally-empty" role="status">
        <span className="tally-empty-icon">
          <Columns3 size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="tally-empty-title">{labels.noColumns}</span>
        <button
          type="button"
          className="tally-button"
          data-primary=""
          onClick={() =>
            grid.view.update((view) => ({
              ...view,
              columns: view.columns.map((state) => ({ ...state, hidden: false })),
            }))
          }
        >
          {labels.showAllColumns}
        </button>
      </div>
    )
  }
  if (filter === undefined) {
    return (
      <div className="tally-empty" role="status">
        <span className="tally-empty-icon">
          <Inbox size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="tally-empty-title">{labels.empty}</span>
      </div>
    )
  }
  return (
    <div className="tally-empty" role="status">
      <span className="tally-empty-icon">
        <SearchX size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="tally-empty-title">{labels.noMatches}</span>
      <p className="tally-empty-detail">
        {labels.noMatchesDetail(printFilter(filter, grid.schema))}
      </p>
      <button
        type="button"
        className="tally-button"
        data-primary=""
        onClick={() => grid.view.setFilter(undefined)}
      >
        {labels.clearFilter}
      </button>
    </div>
  )
}

function Viewport({
  grid,
  initialSize,
  label,
  onIntent,
  cards,
}: Pick<TallyProps, 'grid' | 'initialSize' | 'label' | 'onIntent'> & {
  readonly cards: boolean
}): ReactNode {
  const labels = useLabels()
  const { viewport } = useShell()
  const viewportWidth = useClientWidth(viewport)
  const layout = useColumnLayout(
    grid,
    viewportWidth > GUTTER_WIDTH ? viewportWidth - GUTTER_WIDTH : undefined,
  )
  const status = useGridState(grid, (state) => state.status)
  const error = useGridState(grid, (state) => state.error)
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  const rowCount = useRowModel(grid).rows.length
  const bare = layout.columns.length === 0
  const empty =
    status === 'ready' && (rowCount === 0 || bare) ? (
      <EmptyState grid={grid} columns={layout.columns.length} />
    ) : null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <>
      {status === 'loading' ? <div className="tally-progress" aria-hidden /> : null}
      {status === 'error' ? (
        <div className="tally-status" role="alert">
          <CircleAlert size={15} aria-hidden />
          <span className="tally-status-message" title={message}>
            {message}
          </span>
          <button type="button" className="tally-button" onClick={() => void grid.load()}>
            <RefreshCw size={13} aria-hidden />
            {labels.retry}
          </button>
        </div>
      ) : null}
      {cards ? (
        <div ref={viewport} className="tally-viewport" aria-label={label} data-layout="cards">
          <Cards grid={grid} />
          {empty}
        </div>
      ) : (
        <div
          ref={viewport}
          role="grid"
          className="tally-viewport"
          tabIndex={0}
          aria-label={label}
          aria-busy={status === 'loading'}
          aria-rowcount={matched === undefined ? -1 : matched + 1}
          aria-colcount={layout.columns.length + 1}
          aria-multiselectable
        >
          {bare ? null : (
            <Body grid={grid} layout={layout} initialSize={initialSize} onIntent={onIntent} />
          )}
          {empty}
        </div>
      )}
    </>
  )
}

export function Tally({
  grid,
  renderers,
  editors,
  theme,
  dir,
  className,
  style,
  label,
  initialSize,
  onIntent,
  labels,
  toolbar = true,
  ask,
  layout = 'auto',
  cardsBelow = 620,
  children,
}: TallyProps): ReactNode {
  const mergedLabels = useMemo<TallyLabels>(() => ({ ...defaultLabels, ...labels }), [labels])
  const root = useRef<HTMLDivElement>(null)
  const rootWidth = useClientWidth(root)
  const narrow = rootWidth > 0 && rootWidth < cardsBelow
  const cards = layout === 'cards' || (layout === 'auto' && narrow)
  const viewport = useRef<HTMLDivElement>(null)
  const filterInput = useRef<HTMLInputElement>(null)
  const filterListener = useRef<((text: string) => void) | null>(null)
  const density = useView(grid, (view) => view.density)
  const shell = useMemo<TallyShell>(
    () => ({
      root,
      viewport,
      filterInput,
      prefillFilter: (text) => filterListener.current?.(text),
      onPrefillFilter: (listener) => {
        filterListener.current = listener
        return () => {
          filterListener.current = null
        }
      },
      renderers: { ...defaultRenderers, ...renderers },
      editors: { ...defaultEditors, ...editors },
    }),
    [renderers, editors],
  )
  return (
    <GridProvider grid={grid}>
      <ShellContext value={shell}>
        <LabelsContext value={mergedLabels}>
          <div
            ref={root}
            className={className === undefined ? 'tally' : `tally ${className}`}
            style={style}
            dir={dir}
            data-density={density}
            {...(theme === undefined ? {} : { 'data-theme': theme })}
            {...(narrow ? { 'data-narrow': '' } : {})}
          >
            {toolbar === true ? (
              <Toolbar grid={grid} ask={ask}>
                {children}
              </Toolbar>
            ) : toolbar === false ? (
              children
            ) : (
              toolbar
            )}
            <Viewport
              grid={grid}
              initialSize={initialSize}
              label={label}
              onIntent={onIntent}
              cards={cards}
            />
          </div>
        </LabelsContext>
      </ShellContext>
    </GridProvider>
  )
}
