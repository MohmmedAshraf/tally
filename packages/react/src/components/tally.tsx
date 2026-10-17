import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { DirectionProvider } from '@base-ui/react/direction-provider'
import { Columns3, Inbox, RefreshCw, SearchX, CircleAlert, X } from 'lucide-react'
import { printFilter, type Grid } from 'tally-core'
import { GridProvider } from '../hooks/context.tsx'
import { useColumnLayout, useGridState, useRowModel, useView } from '../hooks/use-store.ts'
import { Announcer } from './announcer.tsx'
import { Body } from './body.tsx'
import type { DetailRenderer } from './card-detail.tsx'
import { Cards } from './cards.tsx'
import { GUTTER_WIDTH } from './geometry.ts'
import { defaultRenderers, type CellRenderers } from './cells/renderers.tsx'
import { defaultEditors, type CellEditors } from './editors/editors.tsx'
import { ShellContext, useShell, type TallyShell } from './context.ts'
import { LabelsContext, localizedLabels, useLabels, type TallyLabels } from './labels.ts'
import { Toolbar } from './toolbar/toolbar.tsx'
import type { AddColumnHandler } from './toolbar/ai-menu.tsx'
import type { AskHandler } from './toolbar/filter-bar.tsx'
import type { IntentHandler } from './interactions.ts'

export interface TallyAi {
  readonly ask?: AskHandler | undefined
  readonly addColumn?: AddColumnHandler | undefined
  readonly suggestions?: readonly string[] | undefined
}

const ENTER_MS = 900

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
  readonly toolbarStart?: ReactNode
  readonly ai?: TallyAi | undefined
  readonly layout?: 'auto' | 'grid' | 'cards' | undefined
  readonly cardsBelow?: number | undefined
  readonly detail?: DetailRenderer | boolean | undefined
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

function useDirection(
  element: { readonly current: HTMLElement | null },
  dir: 'ltr' | 'rtl' | undefined,
): 'ltr' | 'rtl' {
  const [computed, setComputed] = useState<'ltr' | 'rtl'>('ltr')
  useLayoutEffect(() => {
    const node = element.current
    if (dir !== undefined || node === null) return
    const measure = (): void =>
      setComputed(getComputedStyle(node).direction === 'rtl' ? 'rtl' : 'ltr')
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [element, dir])
  return dir ?? computed
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
      <div className="tally-empty">
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
      <div className="tally-empty">
        <span className="tally-empty-icon">
          <Inbox size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="tally-empty-title">{labels.empty}</span>
      </div>
    )
  }
  return (
    <div className="tally-empty">
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
  const { viewport, failure, fail } = useShell()
  const viewportWidth = useClientWidth(viewport)
  const layout = useColumnLayout(
    grid,
    viewportWidth > GUTTER_WIDTH ? viewportWidth - GUTTER_WIDTH : undefined,
  )
  const status = useGridState(grid, (state) => state.status)
  const error = useGridState(grid, (state) => state.error)
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  const model = useRowModel(grid)
  const bare = layout.columns.length === 0
  const blank = status === 'ready' && (model.items.length === 0 || bare)
  const empty = blank ? <EmptyState grid={grid} columns={layout.columns.length} /> : null
  const rowCount =
    matched === undefined || model.groups.length > 0
      ? -1
      : bare
        ? 1
        : matched + (blank ? 1 : 0) + (grid.capabilities.mutate ? 3 : 2)
  const emptyRow =
    empty === null ? null : (
      <div role="row" className="tally-empty-row">
        <div role="gridcell" className="tally-empty-row" aria-colspan={layout.columns.length + 1}>
          {empty}
        </div>
      </div>
    )
  const problem = failure ?? error
  const message = problem instanceof Error ? problem.message : String(problem)
  return (
    <>
      {status === 'loading' ? <div className="tally-progress" aria-hidden /> : null}
      {status === 'error' || failure !== undefined ? (
        <div className="tally-status" role="alert">
          <CircleAlert size={15} aria-hidden />
          <span className="tally-status-message" title={message}>
            {message}
          </span>
          {failure === undefined ? (
            <button type="button" className="tally-button" onClick={() => void grid.load()}>
              <RefreshCw size={13} aria-hidden />
              {labels.retry}
            </button>
          ) : (
            <button type="button" className="tally-button" onClick={() => fail(undefined)}>
              <X size={13} aria-hidden />
              {labels.close}
            </button>
          )}
        </div>
      ) : null}
      {cards ? (
        <div
          ref={viewport}
          role="region"
          className="tally-viewport"
          aria-label={label}
          data-layout="cards"
        >
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
          aria-rowcount={rowCount}
          aria-colcount={layout.columns.length + 1}
          aria-multiselectable
          style={{ '--tally-viewport-width': `${viewportWidth}px` }}
        >
          {bare ? (
            emptyRow
          ) : (
            <Body
              grid={grid}
              layout={layout}
              initialSize={initialSize}
              onIntent={onIntent}
              empty={emptyRow}
              rowCount={rowCount}
            />
          )}
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
  toolbarStart,
  ai,
  layout = 'auto',
  cardsBelow = 620,
  detail = true,
  children,
}: TallyProps): ReactNode {
  const format = grid.context.format
  const mergedLabels = useMemo<TallyLabels>(
    () => ({ ...localizedLabels(format), ...labels }),
    [format, labels],
  )
  const root = useRef<HTMLDivElement>(null)
  const rootWidth = useClientWidth(root)
  const direction = useDirection(root, dir)
  const narrow = rootWidth > 0 && rootWidth < cardsBelow
  const cards = layout === 'cards' || (layout === 'auto' && narrow)
  const viewport = useRef<HTMLDivElement>(null)
  const filterInput = useRef<HTMLInputElement>(null)
  const filterListener = useRef<((text: string) => void) | null>(null)
  const density = useView(grid, (view) => view.density)
  const [entering, setEntering] = useState<string | undefined>(undefined)
  const [failure, fail] = useState<unknown>(undefined)
  useEffect(() => {
    if (entering === undefined) return
    const timer = setTimeout(() => setEntering(undefined), ENTER_MS)
    return () => clearTimeout(timer)
  }, [entering])
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
      entering,
      enterColumn: setEntering,
      renderers: { ...defaultRenderers, ...renderers },
      editors: { ...defaultEditors, ...editors },
      detail,
      direction,
      label,
      failure,
      fail,
    }),
    [entering, renderers, editors, detail, direction, label, failure],
  )
  return (
    <GridProvider grid={grid}>
      <ShellContext value={shell}>
        <LabelsContext value={mergedLabels}>
          <DirectionProvider direction={direction}>
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
                <Toolbar grid={grid} ai={ai} start={toolbarStart}>
                  {children}
                </Toolbar>
              ) : toolbar === false ? (
                children
              ) : (
                toolbar
              )}
              <Announcer grid={grid} />
              <Viewport
                grid={grid}
                initialSize={initialSize}
                label={label}
                onIntent={onIntent}
                cards={cards}
              />
            </div>
          </DirectionProvider>
        </LabelsContext>
      </ShellContext>
    </GridProvider>
  )
}
