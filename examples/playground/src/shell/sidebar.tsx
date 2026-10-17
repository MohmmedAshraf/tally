import { ChevronDown, RotateCcw, Search, Settings, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Kbd } from '@/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { datasets, type Dataset, type SavedView } from '@/datasets'
import { PEOPLE } from '@/datasets/shared'
import { Photo } from './person.tsx'
import { SettingsMenu, type SettingsMenuProps } from './settings-menu.tsx'
import { viewColor, type SavedViews } from './views.ts'

interface AppSidebarProps extends SettingsMenuProps {
  readonly current: Dataset
  readonly library: SavedViews
  readonly activeView: SavedView | undefined
  readonly onPick: (dataset: Dataset) => void
  readonly onPickView: (view: SavedView) => void
  readonly onSearch: () => void
  readonly locale: string
  readonly side: 'left' | 'right'
}

function compact(count: number, locale: string): string {
  return count >= 10_000
    ? new Intl.NumberFormat(locale, { notation: 'compact' }).format(count)
    : count.toLocaleString(locale)
}

function Mark(): ReactNode {
  return (
    <span className="flex size-8 shrink-0 items-end justify-center gap-[2px] rounded-[10px] bg-linear-135 from-indigo-500 to-indigo-700 p-[7px]">
      {[0.45, 0.8, 0.6].map((height) => (
        <span
          key={height}
          className="w-[3px] rounded-[1px] bg-white/90"
          style={{ height: `${height * 100}%` }}
        />
      ))}
    </span>
  )
}

function ViewItem({
  view,
  index,
  active,
  library,
  onPickView,
}: Pick<AppSidebarProps, 'library' | 'onPickView'> & {
  readonly view: SavedView
  readonly index: number
  readonly active: boolean
}): ReactNode {
  const button = (
    <SidebarMenuButton isActive={active} tooltip={view.name} onClick={() => onPickView(view)}>
      <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
        <span className="size-2 rounded-full" style={{ background: viewColor(index) }} />
      </span>
      <span>{view.name}</span>
    </SidebarMenuButton>
  )
  const action = library.custom.has(view.name)
    ? { label: 'Delete view', icon: Trash2, variant: 'destructive' as const }
    : library.overridden.has(view.name)
      ? { label: 'Reset view', icon: RotateCcw, variant: 'default' as const }
      : undefined
  return (
    <SidebarMenuItem>
      {action === undefined ? (
        button
      ) : (
        <ContextMenu>
          <ContextMenuTrigger render={button} />
          <ContextMenuContent>
            <ContextMenuItem variant={action.variant} onClick={() => library.remove(view.name)}>
              <action.icon />
              {action.label}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </SidebarMenuItem>
  )
}

export function AppSidebar(props: AppSidebarProps): ReactNode {
  const { current, library, activeView, onPick, onPickView, onSearch, locale, side } = props
  return (
    <Sidebar collapsible="icon" variant="inset" side={side}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Mark />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Meridian</span>
                <span className="truncate text-xs text-muted-foreground">Revenue workspace</span>
              </div>
              <ChevronDown className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              variant="outline"
              tooltip="Search"
              className="h-9 text-muted-foreground"
              onClick={onSearch}
            >
              <Search />
              <span>Search</span>
              <Kbd className="ml-auto">⌘K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {datasets.map((dataset) => (
                <SidebarMenuItem key={dataset.id}>
                  <SidebarMenuButton
                    isActive={dataset.id === current.id}
                    tooltip={dataset.title}
                    onClick={() => onPick(dataset)}
                  >
                    <dataset.icon />
                    <span>{dataset.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="font-mono text-muted-foreground">
                    {compact(dataset.rows.length, locale)}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {library.views.map((view, index) => (
                <ViewItem
                  key={view.name}
                  view={view}
                  index={index}
                  active={view.name === activeView?.name}
                  library={library}
                  onPickView={onPickView}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SettingsMenu {...props}>
              <SidebarMenuButton tooltip="Settings">
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SettingsMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Photo id="amara" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{PEOPLE.amara}</span>
                <span className="truncate text-xs text-muted-foreground">Head of Revenue</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
