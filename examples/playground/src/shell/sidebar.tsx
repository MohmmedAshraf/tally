import { ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
} from '@/components/ui/sidebar'
import { dataDatasets, workspaceDatasets, type Dataset } from '@/datasets'

interface AppSidebarProps {
  readonly current: Dataset
  readonly onPick: (dataset: Dataset) => void
  readonly locale: string
  readonly side: 'left' | 'right'
}

function compact(count: number, locale: string): string {
  return count >= 10_000
    ? new Intl.NumberFormat(locale, { notation: 'compact' }).format(count)
    : count.toLocaleString(locale)
}

function Group({
  label,
  items,
  current,
  onPick,
  locale,
  counts,
}: AppSidebarProps & {
  readonly label: string
  readonly items: readonly Dataset[]
  readonly counts: boolean
}): ReactNode {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((dataset) => (
            <SidebarMenuItem key={dataset.id}>
              <SidebarMenuButton
                isActive={dataset.id === current.id}
                tooltip={dataset.title}
                onClick={() => onPick(dataset)}
              >
                <dataset.icon />
                <span>{dataset.title}</span>
              </SidebarMenuButton>
              {counts ? (
                <SidebarMenuBadge>{compact(dataset.rows.length, locale)}</SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar(props: AppSidebarProps): ReactNode {
  return (
    <Sidebar collapsible="icon" variant="inset" side={props.side}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <span className="text-sm font-semibold">A</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Acme Inc.</span>
                <span className="truncate text-xs">Pro workspace</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Workspace" items={workspaceDatasets} counts {...props} />
        <Group label="Data" items={dataDatasets} counts={false} {...props} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">AO</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Ada Okafor</span>
                <span className="truncate text-xs">ada@acme.co</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
