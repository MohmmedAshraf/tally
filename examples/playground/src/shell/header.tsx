import { Check, Link2, Moon, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { sectionOf, type Dataset } from '@/datasets'
import type { PersonId } from '@/datasets/shared'
import { Photo } from './person.tsx'
import type { Theme } from './settings.ts'

export type SimulateMode = 'ready' | 'loading' | 'empty' | 'error'

const SIMULATE_MODES: readonly SimulateMode[] = ['ready', 'loading', 'empty', 'error']
const COLLABORATORS: readonly PersonId[] = ['mateo', 'kenji', 'zeynep']

export interface HeaderProps {
  readonly dataset: Dataset
  readonly live: boolean | undefined
  readonly onToggleLive: () => void
  readonly simulate: SimulateMode | undefined
  readonly onSimulate: (mode: SimulateMode) => void
  readonly theme: Theme
  readonly onToggleTheme: () => void
}

function ShareButton(): ReactNode {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  const share = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={() => void share()}>
      {copied ? <Check /> : <Link2 />}
      {copied ? 'Copied' : 'Share'}
    </Button>
  )
}

export function AppHeader({
  dataset,
  live,
  onToggleLive,
  simulate,
  onSimulate,
  theme,
  onToggleTheme,
}: HeaderProps): ReactNode {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1.5 data-vertical:h-4 data-vertical:self-center"
      />
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
      <div className="hidden items-center md:flex" aria-hidden>
        {COLLABORATORS.map((id, index) => (
          <Photo
            key={id}
            id={id}
            className={
              index === 0 ? 'size-7 ring-2 ring-background' : '-ml-2 size-7 ring-2 ring-background'
            }
          />
        ))}
      </div>
      <ShareButton />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Toggle theme"
        title="Toggle theme"
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>
    </header>
  )
}
