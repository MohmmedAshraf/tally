import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { GridProvider } from '../hooks/context.tsx'
import { useColumnLayout, useGridState, useView } from '../hooks/use-store.ts'
import { Body } from './body.tsx'
import { defaultRenderers, type CellRenderers } from './cells/renderers.tsx'
import { ShellContext, useShell, type TallyShell } from './context.ts'

export interface TallyProps {
  readonly grid: Grid
  readonly renderers?: CellRenderers | undefined
  readonly theme?: 'light' | 'dark' | undefined
  readonly dir?: 'ltr' | 'rtl' | undefined
  readonly className?: string | undefined
  readonly style?: CSSProperties | undefined
  readonly label?: string | undefined
  readonly initialSize?: { readonly width: number; readonly height: number } | undefined
  readonly children?: ReactNode
}

function Viewport({
  grid,
  initialSize,
  label,
}: Pick<TallyProps, 'grid' | 'initialSize' | 'label'>): ReactNode {
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
        <Body grid={grid} layout={layout} initialSize={initialSize} />
      </div>
    </>
  )
}

export function Tally({
  grid,
  renderers,
  theme,
  dir,
  className,
  style,
  label,
  initialSize,
  children,
}: TallyProps): ReactNode {
  const viewport = useRef<HTMLDivElement>(null)
  const density = useView(grid, (view) => view.density)
  const shell = useMemo<TallyShell>(
    () => ({ viewport, renderers: { ...defaultRenderers, ...renderers } }),
    [renderers],
  )
  return (
    <GridProvider grid={grid}>
      <ShellContext value={shell}>
        <div
          className={className === undefined ? 'tally' : `tally ${className}`}
          style={style}
          dir={dir}
          data-density={density}
          {...(theme === undefined ? {} : { 'data-theme': theme })}
        >
          {children}
          <Viewport grid={grid} initialSize={initialSize} label={label} />
        </div>
      </ShellContext>
    </GridProvider>
  )
}
