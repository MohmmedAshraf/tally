import { Moon, Search, Settings2, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { sectionOf, type Dataset } from '@/datasets'
import { SettingsMenu, type SettingsMenuProps } from './settings-menu.tsx'
import type { Theme } from './settings.ts'

export type SimulateMode = 'ready' | 'loading' | 'empty' | 'error'

const SIMULATE_MODES: readonly SimulateMode[] = ['ready', 'loading', 'empty', 'error']

export interface HeaderProps extends SettingsMenuProps {
  readonly dataset: Dataset
  readonly live: boolean | undefined
  readonly onToggleLive: () => void
  readonly simulate: SimulateMode | undefined
  readonly onSimulate: (mode: SimulateMode) => void
  readonly onSearch: () => void
  readonly theme: Theme
  readonly onToggleTheme: () => void
}

export function AppHeader(props: HeaderProps): ReactNode {
  const { dataset, live, onToggleLive, simulate, onSimulate, onSearch, theme, onToggleTheme } =
    props
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">{sectionOf(dataset)}</BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2 font-medium">
              <dataset.icon className="size-4 text-muted-foreground" />
              {dataset.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
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
