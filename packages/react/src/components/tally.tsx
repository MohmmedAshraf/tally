import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { GridProvider } from '../hooks/context.tsx'
import { useColumnLayout, useGridState, useView } from '../hooks/use-store.ts'
import { Body } from './body.tsx'
import { defaultRenderers, type CellRenderers } from './cells/renderers.tsx'
import { defaultEditors, type CellEditors } from './editors/editors.tsx'
import { ShellContext, useShell, type TallyShell } from './context.ts'
import { LabelsContext, defaultLabels, type TallyLabels } from './labels.ts'
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
  readonly children?: ReactNode
}

function Viewport({
  grid,
  initialSize,
  label,
  onIntent,
}: Pick<TallyProps, 'grid' | 'initialSize' | 'label' | 'onIntent'>): ReactNode {
  const layout = useColumnLayout(grid)
  const { viewport } = useShell()
  const status = useGridState(grid, (state) => state.status)
  const error = useGridState(grid, (state) => state.error)
  const matched = useGridState(grid, (state) => state.matched ?? state.total)
  return (
    <>
      {status === 'loading' ? <div className="tally-progress" aria-hidden /> : null}
      {status === 'error' ? (
        <div className="tally-status" role="alert">
          {error instanceof Error ? error.message : String(error)}
        </div>
      ) : null}
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
        <Body grid={grid} layout={layout} initialSize={initialSize} onIntent={onIntent} />
      </div>
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
  children,
}: TallyProps): ReactNode {
  const mergedLabels = useMemo<TallyLabels>(() => ({ ...defaultLabels, ...labels }), [labels])
  const root = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const filterInput = useRef<HTMLInputElement>(null)
  const density = useView(grid, (view) => view.density)
  const shell = useMemo<TallyShell>(
    () => ({
      root,
      viewport,
      filterInput,
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
            <Viewport grid={grid} initialSize={initialSize} label={label} onIntent={onIntent} />
          </div>
        </LabelsContext>
      </ShellContext>
    </GridProvider>
  )
}
