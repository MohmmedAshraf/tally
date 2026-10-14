import { useState, type ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { datasetById, type Dataset, type SavedView } from '@/datasets'
import { slug } from '@/datasets/shared'
import { AppSidebar } from './shell/sidebar.tsx'
import { useHashRoute, useSettings } from './shell/settings.ts'
import { useSavedViews } from './shell/views.ts'
import { Workspace } from './shell/workspace.tsx'

export function App(): ReactNode {
  const [settings, patchSettings] = useSettings()
  const [route, navigate] = useHashRoute()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const dataset = datasetById(route.dataset)
  const library = useSavedViews(dataset)
  const activeView =
    library.views.find((view) => slug(view.name) === route.view) ?? library.views[0]
  const go = (next: Dataset, view?: SavedView): void =>
    navigate(next.id, view === undefined ? undefined : slug(view.name))
  return (
    <TooltipProvider>
      <SidebarProvider className="h-full min-h-0">
        <AppSidebar
          current={dataset}
          library={library}
          activeView={activeView}
          onPick={(next) => go(next)}
          onPickView={(view) => go(dataset, view)}
          onSearch={() => setPaletteOpen(true)}
          locale={settings.locale}
          side={settings.dir === 'rtl' ? 'right' : 'left'}
          settings={settings}
          onSettings={patchSettings}
          remote={dataset.remote}
        />
        <SidebarInset className="min-h-0 min-w-0">
          <Workspace
            dataset={dataset}
            viewSlug={route.view}
            settings={settings}
            onSettings={patchSettings}
            onNavigate={go}
            library={library}
            paletteOpen={paletteOpen}
            onPaletteOpenChange={setPaletteOpen}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
