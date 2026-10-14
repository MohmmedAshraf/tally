import { useMemo, useState } from 'react'
import type { Dataset, SavedView } from '@/datasets'

export interface SavedViews {
  readonly views: readonly SavedView[]
  readonly custom: ReadonlySet<string>
  readonly overridden: ReadonlySet<string>
  readonly upsert: (view: SavedView) => void
  readonly remove: (name: string) => void
}

const VIEW_COLORS = [
  'oklch(0.62 0.18 25)',
  'oklch(0.6 0.15 255)',
  'oklch(0.62 0.14 150)',
  'oklch(0.7 0.15 75)',
  'oklch(0.6 0.17 300)',
] as const

export function viewColor(index: number): string {
  return VIEW_COLORS[index % VIEW_COLORS.length] ?? VIEW_COLORS[0]
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

export function useSavedViews(dataset: Dataset): SavedViews {
  const key = `tally-playground-views:${dataset.id}`
  const [stored, setStored] = useState<Readonly<Record<string, readonly SavedView[]>>>({})
  const extra = stored[key] ?? readSavedViews(key)
  const persist = (next: readonly SavedView[]): void => {
    setStored((state) => ({ ...state, [key]: next }))
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
