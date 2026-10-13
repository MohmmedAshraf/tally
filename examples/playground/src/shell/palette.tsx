import { Filter } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { datasets, type Dataset, type SavedView } from '@/datasets'

export interface PaletteProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly dataset: Dataset
  readonly views: readonly SavedView[]
  readonly onPickDataset: (dataset: Dataset) => void
  readonly onPickView: (view: SavedView) => void
  readonly onQuery: (query: string) => void
}

export function Palette({
  open,
  onOpenChange,
  dataset,
  views,
  onPickDataset,
  onPickView,
  onQuery,
}: PaletteProps): ReactNode {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onOpenChange])
  const run = (action: () => void): void => {
    action()
    onOpenChange(false)
  }
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search or jump to"
      description="Jump to a table, a view or run a query"
    >
      <Command>
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>Nothing found</CommandEmpty>
          <CommandGroup heading="Jump to">
            {datasets.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`table ${entry.title}`}
                onSelect={() => run(() => onPickDataset(entry))}
              >
                <entry.icon strokeWidth={1.7} />
                {entry.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={`${dataset.title} views`}>
            {views.map((view) => (
              <CommandItem
                key={view.name}
                value={`view ${view.name}`}
                onSelect={() => run(() => onPickView(view))}
              >
                <dataset.icon strokeWidth={1.7} />
                {view.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Try a query">
            {dataset.examples.map((example) => (
              <CommandItem
                key={example}
                value={`query ${example}`}
                onSelect={() => run(() => onQuery(example))}
              >
                <Filter strokeWidth={1.7} />
                <span className="font-mono text-xs">{example}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
