import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { datasetById, type Dataset, type SavedView } from '@/datasets'
import { slug } from '@/datasets/shared'
import { AppSidebar } from './shell/sidebar.tsx'
import { useHashRoute, useSettings } from './shell/settings.ts'
import { Workspace } from './shell/workspace.tsx'

export function App(): ReactNode {
  const [settings, patchSettings] = useSettings()
  const [route, navigate] = useHashRoute()
  const dataset = datasetById(route.dataset)
  const go = (next: Dataset, view?: SavedView): void =>
    navigate(next.id, view === undefined ? undefined : slug(view.name))
  return (
    <TooltipProvider>
      <SidebarProvider className="h-full min-h-0">
        <AppSidebar
          current={dataset}
          onPick={(next) => go(next)}
          locale={settings.locale}
          side={settings.dir === 'rtl' ? 'right' : 'left'}
        />
        <SidebarInset className="min-h-0 min-w-0">
          <Workspace
            dataset={dataset}
            viewSlug={route.view}
            settings={settings}
            onSettings={patchSettings}
            onNavigate={go}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
