import { Moon, Plus, Search, Settings2, Sun } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Dataset, SavedView } from '@/datasets'
import { SettingsMenu, type SettingsMenuProps } from './settings-menu.tsx'
import type { Theme } from './settings.ts'

export type SimulateMode = 'ready' | 'loading' | 'empty' | 'error'

const SIMULATE_MODES: readonly SimulateMode[] = ['ready', 'loading', 'empty', 'error']

export interface HeaderProps extends SettingsMenuProps {
  readonly dataset: Dataset
  readonly views: readonly SavedView[]
  readonly counts: readonly (number | undefined)[]
  readonly active: SavedView
  readonly dirty: boolean
  readonly onPickView: (view: SavedView) => void
  readonly onSaveView: () => void
  readonly onSaveAs: (name: string) => void
  readonly onRevert: () => void
  readonly live: boolean | undefined
  readonly onToggleLive: () => void
  readonly simulate: SimulateMode | undefined
  readonly onSimulate: (mode: SimulateMode) => void
  readonly onSearch: () => void
  readonly theme: Theme
  readonly onToggleTheme: () => void
  readonly locale: string
}

function SaveAs({ onSave }: { readonly onSave: (name: string) => void }): ReactNode {
  const [name, setName] = useState<string | undefined>(undefined)
  if (name === undefined) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Save as new view"
        title="Save as new view"
        onClick={() => setName('')}
      >
        <Plus />
      </Button>
    )
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && name.trim() !== '') {
      onSave(name.trim())
      setName(undefined)
    }
    if (event.key === 'Escape') setName(undefined)
  }
  return (
    <Input
      autoFocus
      value={name}
      placeholder="Name this view"
      aria-label="View name"
      className="h-8 w-44"
      onChange={(event) => setName(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => setName(undefined)}
    />
  )
}

export function AppHeader(props: HeaderProps): ReactNode {
  const {
    dataset,
    views,
    counts,
    active,
    dirty,
    onPickView,
    onSaveView,
    onSaveAs,
    onRevert,
    live,
    onToggleLive,
    simulate,
    onSimulate,
    onSearch,
    theme,
    onToggleTheme,
    locale,
  } = props
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <h1 className="flex items-center gap-2 text-sm font-medium">
        <dataset.icon className="size-4 text-muted-foreground" />
        {dataset.title}
      </h1>
      <Tabs
        value={active.name}
        onValueChange={(name) => {
          const view = views.find((entry) => entry.name === name)
          if (view !== undefined) onPickView(view)
        }}
        className="ml-2 min-w-0"
      >
        <TabsList>
          {views.map((view, index) => {
            const count = counts[index]
            return (
              <TabsTrigger key={view.name} value={view.name}>
                {view.name}
                {count === undefined ? null : (
                  <Badge variant="secondary" className="tabular-nums">
                    {count.toLocaleString(locale)}
                  </Badge>
                )}
                {view.name === active.name && dirty ? (
                  <span title="Unsaved changes" className="size-1.5 rounded-full bg-primary" />
                ) : null}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
      {dirty ? (
        <>
          <Button variant="secondary" size="sm" onClick={onSaveView}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onRevert}>
            Revert
          </Button>
        </>
      ) : null}
      <SaveAs onSave={onSaveAs} />
      <div className="flex-1" />
      {simulate === undefined ? null : (
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[simulate]}
          onValueChange={(value) => {
            const next = SIMULATE_MODES.find((mode) => mode === value[0])
            if (next !== undefined) onSimulate(next)
          }}
        >
          {SIMULATE_MODES.map((mode) => (
            <ToggleGroupItem key={mode} value={mode} className="capitalize">
              {mode}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {live === undefined ? null : (
        <Button
          variant={live ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={live}
          title="Stream simulated revenue updates"
          onClick={onToggleLive}
        >
          <span
            className={
              live
                ? 'size-2 animate-pulse rounded-full bg-emerald-500'
                : 'size-2 rounded-full bg-muted-foreground'
            }
          />
          {live ? 'Live' : 'Go live'}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="hidden w-56 justify-start text-muted-foreground lg:flex"
        onClick={onSearch}
      >
        <Search />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Toggle theme"
        title="Toggle theme"
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>
      <SettingsMenu {...props}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Playground settings"
          title="Playground settings"
        >
          <Settings2 />
        </Button>
      </SettingsMenu>
    </header>
  )
}
