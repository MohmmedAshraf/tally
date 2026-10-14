import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { SavedView } from '@/datasets'

export interface ViewTabsProps {
  readonly views: readonly SavedView[]
  readonly counts: readonly (number | undefined)[]
  readonly active: SavedView
  readonly dirty: boolean
  readonly locale: string
  readonly onPickView: (view: SavedView) => void
  readonly onSaveView: () => void
  readonly onSaveAs: (name: string) => void
  readonly onRevert: () => void
  readonly custom: ReadonlySet<string>
  readonly overridden: ReadonlySet<string>
  readonly onDeleteView: (name: string) => void
}

function SaveAs({ onSave }: { readonly onSave: (name: string) => void }): ReactNode {
  const [name, setName] = useState<string | undefined>(undefined)
  if (name === undefined) {
    return (
      <Button
        variant="ghost"
        size="icon"
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
      className="h-9 w-44"
      onChange={(event) => setName(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => setName(undefined)}
    />
  )
}

export function ViewTabs({
  views,
  counts,
  active,
  dirty,
  locale,
  onPickView,
  onSaveView,
  onSaveAs,
  onRevert,
  custom,
  overridden,
  onDeleteView,
}: ViewTabsProps): ReactNode {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <ToggleGroup
        value={[active.name]}
        onValueChange={(value) => {
          const view = views.find((entry) => entry.name === value[0])
          if (view !== undefined) onPickView(view)
        }}
        aria-label="Saved views"
      >
        {views.map((view, index) => {
          const count = counts[index]
          const tab = (
            <ToggleGroupItem key={view.name} value={view.name} className="px-3">
              {view.name}
              {count === undefined ? null : (
                <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
                  {count.toLocaleString(locale)}
                </span>
              )}
              {view.name === active.name && dirty ? (
                <span title="Unsaved changes" className="size-1.5 rounded-full bg-primary" />
              ) : null}
            </ToggleGroupItem>
          )
          const action = custom.has(view.name)
            ? { label: 'Delete view', icon: Trash2 }
            : overridden.has(view.name)
              ? { label: 'Reset view', icon: RotateCcw }
              : undefined
          if (action === undefined) return tab
          return (
            <ContextMenu key={view.name}>
              <ContextMenuTrigger render={tab} />
              <ContextMenuContent>
                <ContextMenuItem
                  variant={custom.has(view.name) ? 'destructive' : 'default'}
                  onClick={() => onDeleteView(view.name)}
                >
                  <action.icon />
                  {action.label}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </ToggleGroup>
      {dirty ? (
        <>
          <Button variant="secondary" onClick={onSaveView}>
            Save
          </Button>
          <Button variant="ghost" onClick={onRevert}>
            Revert
          </Button>
        </>
      ) : null}
      <SaveAs onSave={onSaveAs} />
    </div>
  )
}
