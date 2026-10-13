import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { clampWidth, type Grid, type LayoutColumn } from 'tally-core'
import { measureColumnWidth } from './autosize.ts'
import { useShell } from './context.ts'
import { useLabels } from './labels.ts'

export function ResizeHandle({
  grid,
  entry,
}: {
  readonly grid: Grid
  readonly entry: LayoutColumn
}): ReactNode {
  const labels = useLabels()
  const { root } = useShell()
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    const direction = getComputedStyle(handle).direction === 'rtl' ? -1 : 1
    const startX = event.clientX
    const startWidth = entry.width
    handle.setPointerCapture(event.pointerId)
    const onMove = (move: globalThis.PointerEvent): void => {
      const width = clampWidth(entry.column, startWidth + (move.clientX - startX) * direction)
      grid.view.resizeColumn(entry.column.id, width)
    }
    const onUp = (): void => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === 'ArrowRight' ? 8 : event.key === 'ArrowLeft' ? -8 : 0
    if (step === 0) return
    event.preventDefault()
    grid.view.resizeColumn(entry.column.id, clampWidth(entry.column, entry.width + step))
  }
  return (
    <div
      className="tally-resize-handle"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={labels.resizeColumn}
      aria-valuenow={entry.width}
      title={labels.resizeColumn}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        const width =
          root.current === null ? undefined : measureColumnWidth(root.current, entry.column)
        if (width !== undefined) grid.view.resizeColumn(entry.column.id, width)
      }}
    />
  )
}
