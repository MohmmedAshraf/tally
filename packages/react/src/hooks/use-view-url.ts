import { useEffect, useEffectEvent } from 'react'
import { defaultView, viewFromUrlString, viewToUrlString, type Grid, type View } from 'tally-core'

export interface ViewUrlSync {
  readonly param?: string | undefined
  readonly history?: 'replace' | 'push' | undefined
  readonly encode?: ((view: View, search: string) => string) | undefined
  readonly decode?: ((search: string) => View) | undefined
}

export function useViewUrl(grid: Grid, options: ViewUrlSync = {}): void {
  const { param, history: mode = 'replace' } = options
  const encode = useEffectEvent(
    (view: View, search: string): string =>
      options.encode?.(view, search) ?? viewToUrlString(view, grid.schema, { param, base: search }),
  )
  const decode = useEffectEvent(
    (search: string): View =>
      options.decode?.(search) ?? viewFromUrlString(search, grid.schema, { param }),
  )

  useEffect(() => {
    const write = (view: View): void => {
      const search = location.search.slice(1)
      const next = encode(view, search)
      if (next === search) return
      const url = `${location.pathname}${next === '' ? '' : `?${next}`}${location.hash}`
      if (mode === 'push') history.pushState(history.state, '', url)
      else history.replaceState(history.state, '', url)
    }
    const read = (): View | undefined => {
      try {
        return decode(location.search.slice(1))
      } catch {
        return undefined
      }
    }
    const restore = (): void => {
      const view = read()
      if (view !== undefined) grid.view.set(view)
    }
    const initial = read()
    if (initial === undefined || encode(initial, '') === encode(defaultView(grid.schema), '')) {
      write(grid.view.get())
    } else {
      grid.view.set(initial)
    }
    const stop = grid.view.subscribe(write)
    addEventListener('popstate', restore)
    return () => {
      stop()
      removeEventListener('popstate', restore)
    }
  }, [grid, mode])
}
