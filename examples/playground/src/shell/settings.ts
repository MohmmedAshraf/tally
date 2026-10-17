import { useEffect, useState } from 'react'
import type { Pagination } from 'tally-core'

export const LOCALES = ['en-US', 'de-DE', 'ar-EG', 'ja-JP'] as const

type Locale = (typeof LOCALES)[number]

export type Theme = 'light' | 'dark'

export type Direction = 'ltr' | 'rtl'

export type Transport = 'array' | 'http'

export interface Settings {
  readonly theme: Theme
  readonly dir: Direction
  readonly locale: Locale
  readonly transport: Transport
  readonly pagination: Pagination
  readonly phone: boolean
}

const STORAGE_KEY = 'tally-playground-settings'

const defaults: Settings = {
  theme: 'light',
  dir: 'ltr',
  locale: 'en-US',
  transport: 'array',
  pagination: 'none',
  phone: false,
}

function isLocale(value: unknown): value is Locale {
  return LOCALES.some((entry) => entry === value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function systemTheme(settings: Settings): Settings {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  return dark ? { ...settings, theme: 'dark' } : settings
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return systemTheme(defaults)
    const stored: unknown = JSON.parse(raw)
    if (!isRecord(stored)) return systemTheme(defaults)
    return {
      theme: stored['theme'] === 'dark' ? 'dark' : 'light',
      dir: stored['dir'] === 'rtl' ? 'rtl' : 'ltr',
      locale: isLocale(stored['locale']) ? stored['locale'] : 'en-US',
      transport: stored['transport'] === 'http' ? 'http' : 'array',
      pagination:
        stored['pagination'] === 'offset' || stored['pagination'] === 'cursor'
          ? stored['pagination']
          : 'none',
      phone: stored['phone'] === true,
    }
  } catch {
    return systemTheme(defaults)
  }
}

export function useSettings(): readonly [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      return
    }
  }, [settings])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    document.documentElement.dir = settings.dir
    document.documentElement.lang = settings.locale
  }, [settings.theme, settings.dir, settings.locale])
  return [settings, (patch) => setSettings((current) => ({ ...current, ...patch }))]
}

export interface Route {
  readonly dataset: string | undefined
  readonly view: string | undefined
}

function readRoute(): Route {
  const [dataset, view] = location.hash.replace(/^#\/?/, '').split('/')
  return { dataset: dataset === '' ? undefined : dataset, view: view === '' ? undefined : view }
}

export function useHashRoute(): readonly [Route, (dataset: string, view?: string) => void] {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onChange = (): void => setRoute(readRoute())
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return [
    route,
    (dataset, view) => {
      const hash = view === undefined ? `/${dataset}` : `/${dataset}/${view}`
      if (dataset === readRoute().dataset) {
        location.hash = hash
        return
      }
      history.pushState(null, '', `${location.pathname}#${hash}`)
      setRoute(readRoute())
    },
  ]
}
