import { CircleAlert, RefreshCw } from 'lucide-react'
import { Suspense, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { connectHttpSource, type HttpConnection } from 'tally-adapters'
import { createAskHandler, designColumn, withAiColumns, type ColumnDesign } from 'tally-ai'
import {
  createArraySource,
  defaultView,
  parseQuery,
  printQuery,
  type ArraySource,
  type DataSource,
  type FormatContext,
  type Grid,
  type Schema,
  type View,
} from 'tally-core'
import { Tally, defaultLabels, useGrid, useRows, useView, type TallyAi } from 'tally-react'
import { useIsMobile } from '@/hooks/use-mobile'
import type { Dataset, SavedView } from '@/datasets'
import { models, useAiAvailable } from './ai.ts'
import { AppHeader, type SimulateMode } from './header.tsx'
import { Palette } from './palette.tsx'
import type { Settings } from './settings.ts'
import { ViewTabs } from './views.tsx'
import { slug } from '@/datasets/shared'

export interface WorkspaceProps {
  readonly dataset: Dataset
  readonly viewSlug: string | undefined
  readonly settings: Settings
  readonly onSettings: (patch: Partial<Settings>) => void
  readonly onNavigate: (dataset: Dataset, view?: SavedView) => void
}

const connections = new Map<string, Promise<HttpConnection>>()

function connect(id: string): Promise<HttpConnection> {
  let pending = connections.get(id)
  if (pending === undefined) {
    pending = connectHttpSource({ url: `/api/tally/${id}` })
    connections.set(id, pending)
  }
  return pending
}

function simulated(source: DataSource, mode: SimulateMode): DataSource {
  if (mode === 'ready') return source
  return {
    ...source,
    query: () => {
      if (mode === 'loading') return new Promise(() => undefined)
      if (mode === 'empty') return Promise.resolve({ rows: [], total: 0, matched: 0 })
      return Promise.reject(new Error('The deploy service did not respond'))
    },
  }
}

function canonical(query: string, schema: Schema): string {
  return printQuery(parseQuery(query, schema).query, schema)
}

function viewFor(dataset: Dataset, saved: SavedView): View {
  const base = defaultView(dataset.schema)
  const parsed = parseQuery(saved.query, dataset.schema).query
  return {
    ...base,
    ...(dataset.density === undefined ? {} : { density: dataset.density }),
    filter: parsed.filter,
    sort: parsed.sort,
    group: parsed.group,
  }
}

function isSavedView(entry: unknown): entry is SavedView {
  if (typeof entry !== 'object' || entry === null) return false
  const record: Record<string, unknown> = { ...entry }
  return typeof record['name'] === 'string' && typeof record['query'] === 'string'
}

function readSavedViews(key: string): readonly SavedView[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedView) : []
  } catch {
    return []
  }
}

interface SavedViews {
  readonly views: readonly SavedView[]
  readonly custom: ReadonlySet<string>
  readonly overridden: ReadonlySet<string>
  readonly upsert: (view: SavedView) => void
  readonly remove: (name: string) => void
}

function useSavedViews(dataset: Dataset): SavedViews {
  const key = `tally-playground-views:${dataset.id}`
  const [extra, setExtra] = useState<readonly SavedView[]>(() => readSavedViews(key))
  const persist = (next: readonly SavedView[]): void => {
    setExtra(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      return
    }
  }
  const library = useMemo(() => {
    const overrides = new Map(extra.map((view) => [view.name, view]))
    const names = new Set(dataset.views.map((view) => view.name))
    const custom = extra.filter((view) => !names.has(view.name))
    return {
      views: [...dataset.views.map((view) => overrides.get(view.name) ?? view), ...custom],
      custom: new Set(custom.map((view) => view.name)),
      overridden: new Set(extra.filter((view) => names.has(view.name)).map((view) => view.name)),
    }
  }, [dataset, extra])
  return {
    ...library,
    upsert: (view) => persist([...extra.filter((entry) => entry.name !== view.name), view]),
    remove: (name) => persist(extra.filter((entry) => entry.name !== name)),
  }
}

function useViewCounts(grid: Grid, views: readonly SavedView[]): readonly (number | undefined)[] {
  const version = useRows(grid).version
  const [counts, setCounts] = useState<readonly (number | undefined)[]>([])
  useEffect(() => {
    let cancelled = false
    const count = async (view: SavedView): Promise<number | undefined> => {
      try {
        const response = await grid.source.query({
          version: 1,
          filter: parseQuery(view.query, grid.schema).query.filter,
          sort: [],
          page: { offset: 0, limit: 1 },
        })
        return response.matched ?? response.total
      } catch {
        return undefined
      }
    }
    const refresh = async (): Promise<void> => {
      const next = await Promise.all(views.map(count))
      if (!cancelled) setCounts(next)
    }
    void refresh()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [grid, views, version])
  return counts
}

function isArraySource(source: DataSource): source is ArraySource {
  return 'patch' in source && 'rows' in source
}

interface AddedColumn extends ColumnDesign {
  readonly after: string | undefined
}

interface AiState {
  readonly schema: Schema
  readonly source: DataSource
  readonly ai: TallyAi
}

function useAi(dataset: Dataset, base: DataSource, baseSchema: Schema, enabled: boolean): AiState {
  const [added, setAdded] = useState<readonly AddedColumn[]>([])
  const [cache] = useState(() => new Map<string, unknown>())
  const schema = useMemo(
    () =>
      added.reduce((current, entry) => {
        const anchor = current.columns.findIndex((column) => column.id === entry.after)
        return current.extend([entry.column], anchor + 1)
      }, baseSchema),
    [baseSchema, added],
  )
  const source = useMemo(
    () =>
      added.length === 0
        ? base
        : withAiColumns(
            base,
            schema,
            added.map((entry) => ({
              column: entry.column.id,
              model: models.fill,
              instruction: entry.instruction,
              cache,
            })),
          ),
    [base, schema, added, cache],
  )
  const ai = useMemo<TallyAi>(
    () => ({
      ask: createAskHandler({ model: models.ask, examples: dataset.examples }),
      addColumn: async (prompt, grid) => {
        const design = await designColumn(prompt, { model: models.design, schema: grid.schema })
        const active = grid.selection.get().active
        const after =
          active === undefined
            ? grid.schema.columns[0]?.id
            : grid.layout().columns[active.column]?.column.id
        setAdded((list) => [...list, { ...design, after }])
        return design.column.id
      },
      suggestions: dataset.aiColumns ?? [],
    }),
    [dataset],
  )
  return { schema, source, ai: enabled ? ai : {} }
}

function numbers(value: unknown): readonly number[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'number') : []
}

function useLive(source: DataSource, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !isArraySource(source)) return
    const tick = (): void => {
      const rows = source.rows()
      const row = rows[Math.floor(Math.random() * Math.min(rows.length, 120))]
      if (row === undefined || typeof row['mrr'] !== 'number') return
      const mrr = Math.max(0, row['mrr'] + Math.round((Math.random() - 0.45) * 400))
      const history = numbers(row['history']).slice(1)
      source.patch({ upserts: [{ ...row, mrr, history: [...history, mrr] }] })
    }
    const timer = setInterval(tick, 1200)
    return () => clearInterval(timer)
  }, [source, enabled])
}

interface ScreenProps extends WorkspaceProps {
  readonly source: DataSource
  readonly schema: Schema
  readonly live: boolean
  readonly onToggleLive: () => void
  readonly simulate: SimulateMode | undefined
  readonly onSimulate: (mode: SimulateMode) => void
}

function Screen({
  dataset,
  viewSlug,
  settings,
  onSettings,
  onNavigate,
  source: baseSource,
  schema: baseSchema,
  live,
  onToggleLive,
  simulate,
  onSimulate,
}: ScreenProps): ReactNode {
  const library = useSavedViews(dataset)
  const { views, upsert: saveView } = library
  const aiAvailable = useAiAvailable()
  const { schema, source, ai } = useAi(dataset, baseSource, baseSchema, aiAvailable)
  const active = views.find((view) => slug(view.name) === viewSlug) ?? views[0]!
  const format = useMemo<FormatContext>(
    () => ({ locale: settings.locale, timeZone: 'UTC', numberingSystem: 'latn' }),
    [settings.locale],
  )
  const grid = useGrid({ schema, source, format, view: viewFor(dataset, active) })
  const view = useView(grid)
  const counts = useViewCounts(grid, views)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const mobile = useIsMobile()
  useLive(baseSource, live)
  const current = printQuery({ filter: view.filter, sort: view.sort, group: view.group }, schema)
  const dirty = current !== canonical(active.query, schema)
  const applyView = (saved: SavedView): void => {
    grid.view.set(viewFor(dataset, saved))
    onNavigate(dataset, saved)
  }
  const applyQuery = (query: string): void => {
    const parsed = parseQuery(query, schema).query
    grid.view.update((state) => ({
      ...state,
      filter: parsed.filter,
      sort: parsed.sort.length > 0 ? parsed.sort : state.sort,
      group: parsed.group ?? state.group,
    }))
  }
  const table = (
    <Tally
      grid={grid}
      label={dataset.title}
      theme={settings.theme}
      dir={settings.dir}
      layout={settings.phone ? 'cards' : 'auto'}
      className="h-full"
      ai={ai}
      toolbarStart={
        settings.phone ? undefined : (
          <ViewTabs
            views={views}
            counts={counts}
            active={active}
            dirty={dirty}
            locale={settings.locale}
            onPickView={applyView}
            onSaveView={() => saveView({ name: active.name, query: current })}
            onSaveAs={(name) => {
              saveView({ name, query: current })
              onNavigate(dataset, { name, query: current })
            }}
            onRevert={() => applyView(active)}
            custom={library.custom}
            overridden={library.overridden}
            onDeleteView={(name) => {
              library.remove(name)
              if (name === active.name) {
                const fallback = dataset.views[0] ?? views.find((entry) => entry.name !== name)
                if (fallback !== undefined) applyView(fallback)
              }
            }}
          />
        )
      }
    />
  )
  return (
    <>
      <AppHeader
        dataset={dataset}
        live={dataset.live === true && isArraySource(baseSource) ? live : undefined}
        onToggleLive={onToggleLive}
        simulate={simulate}
        onSimulate={onSimulate}
        onSearch={() => setPaletteOpen(true)}
        theme={settings.theme}
        onToggleTheme={() => onSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        settings={settings}
        onSettings={onSettings}
        remote={dataset.remote}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        {settings.phone && !mobile ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted p-8">
            <div className="h-full max-h-[780px] w-[390px] overflow-hidden rounded-[2rem] border bg-background">
              {table}
            </div>
          </div>
        ) : (
          table
        )}
      </main>
      <Palette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        dataset={dataset}
        views={views}
        onPickDataset={(next) => onNavigate(next)}
        onPickView={applyView}
        onQuery={applyQuery}
      />
    </>
  )
}

function RemoteScreen(props: Omit<ScreenProps, 'source' | 'schema'>): ReactNode {
  const connection = use(connect(props.dataset.id))
  return <Screen {...props} source={connection.source} schema={connection.schema} />
}

function ConnectionFailed({
  error,
  resetErrorBoundary,
  settings,
}: FallbackProps & { readonly settings: Settings }): ReactNode {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="tally flex-1" data-theme={settings.theme} dir={settings.dir}>
      <div className="tally-status" role="alert">
        <CircleAlert size={15} aria-hidden />
        <span className="tally-status-message" title={message}>
          {message}
        </span>
        <button type="button" className="tally-button" onClick={resetErrorBoundary}>
          <RefreshCw size={13} aria-hidden />
          {defaultLabels.retry}
        </button>
      </div>
    </div>
  )
}

export function Workspace(props: WorkspaceProps): ReactNode {
  const { dataset, settings } = props
  const [live, setLive] = useState(false)
  const [simulate, setSimulate] = useState<SimulateMode>('ready')
  const remote = settings.transport === 'http' && dataset.remote
  const source = useMemo(
    () =>
      remote
        ? undefined
        : simulated(
            createArraySource(dataset.rows, dataset.schema, { pagination: settings.pagination }),
            dataset.simulate === true ? simulate : 'ready',
          ),
    [dataset, remote, settings.pagination, simulate],
  )
  const shared = {
    ...props,
    live,
    onToggleLive: () => setLive((value) => !value),
    simulate: dataset.simulate === true ? simulate : undefined,
    onSimulate: setSimulate,
  }
  if (source === undefined) {
    return (
      <ErrorBoundary
        fallbackRender={(fallback) => <ConnectionFailed {...fallback} settings={settings} />}
        onReset={() => connections.delete(dataset.id)}
      >
        <Suspense fallback={<div className="flex-1 bg-background" />}>
          <RemoteScreen key={`${dataset.id}:http`} {...shared} />
        </Suspense>
      </ErrorBoundary>
    )
  }
  return (
    <Screen
      key={`${dataset.id}:${settings.pagination}:${simulate}`}
      {...shared}
      source={source}
      schema={dataset.schema}
    />
  )
}
