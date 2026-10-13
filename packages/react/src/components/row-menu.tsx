import { ContextMenu } from '@base-ui/react/context-menu'
import { Copy, Pin, PinOff, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toTsv, type Grid, type RowKey } from 'tally-core'
import { useShell } from './context.ts'
import { useLabels } from './labels.ts'

export interface RowMenuProps {
  readonly grid: Grid
  readonly children: ReactNode
}

function rowKeyOf(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined
  return target.closest<HTMLElement>('[data-key]')?.dataset['key']
}

export function RowMenu({ grid, children }: RowMenuProps): ReactNode {
  const labels = useLabels()
  const { root } = useShell()
  const [keys, setKeys] = useState<readonly RowKey[]>([])
  const pinned = keys.length > 0 && keys.every((key) => grid.view.get().pinnedRows.includes(key))
  const capture = (target: EventTarget | null): void => {
    const key = rowKeyOf(target)
    if (key === undefined) {
      setKeys([])
      return
    }
    const item = grid.model().rows.find((candidate) => String(candidate.key) === key)
    if (item === undefined) {
      setKeys([])
      return
    }
    const selected = grid.selection.get().rows
    setKeys(selected.has(item.key) ? [...selected] : [item.key])
  }
  const copy = (): void => {
    const rows = grid
      .model()
      .rows.filter((item) => keys.includes(item.key))
      .map((item) => item.row)
    const columns = grid.layout().columns.map((entry) => entry.column)
    void navigator.clipboard.writeText(
      toTsv(rows, grid.schema, { columns, format: grid.context.format }),
    )
  }
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        className="tally-sheet-menu"
        render={<div onContextMenuCapture={(event) => capture(event.target)} />}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={root}>
        <ContextMenu.Positioner className="tally-popup-positioner" positionMethod="fixed">
          <ContextMenu.Popup className="tally-popup tally-menu">
            {keys.length === 0 ? null : (
              <>
                <ContextMenu.Item
                  className="tally-popup-item"
                  onClick={() => {
                    for (const key of keys) grid.view.togglePinnedRow(key)
                  }}
                >
                  {pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
                  {pinned ? labels.unpinRow(keys.length) : labels.pinRow(keys.length)}
                </ContextMenu.Item>
                <ContextMenu.Item className="tally-popup-item" onClick={copy}>
                  <Copy size={14} aria-hidden />
                  {labels.copy}
                </ContextMenu.Item>
                {grid.capabilities.mutate ? (
                  <>
                    <ContextMenu.Separator className="tally-menu-separator" />
                    <ContextMenu.Item
                      className="tally-popup-item"
                      data-danger=""
                      onClick={() => void grid.deleteRows(keys)}
                    >
                      <Trash2 size={14} aria-hidden />
                      {labels.deleteRows(keys.length)}
                    </ContextMenu.Item>
                  </>
                ) : null}
              </>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
