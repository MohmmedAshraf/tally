import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { useEffect, useState, type RefObject } from 'react'
import type { Grid } from 'tally-core'

const COLUMN_DRAG = 'tally-column'

function columnData(columnId: string): Record<string, unknown> {
  return { kind: COLUMN_DRAG, columnId }
}

function columnIdOf(data: Record<string | symbol, unknown>): string | undefined {
  const id = data['columnId']
  return data['kind'] === COLUMN_DRAG && typeof id === 'string' ? id : undefined
}

export type DropEdge = Extract<Edge, 'left' | 'right'>

export function useColumnDrag(
  element: RefObject<HTMLElement | null>,
  columnId: string,
  enabled: boolean,
): { readonly dragging: boolean; readonly edge: DropEdge | undefined } {
  const [dragging, setDragging] = useState(false)
  const [edge, setEdge] = useState<DropEdge | undefined>(undefined)
  useEffect(() => {
    const target = element.current
    if (target === null || !enabled) return
    const data = columnData(columnId)
    const edgeOf = (payload: Record<string | symbol, unknown>): DropEdge | undefined => {
      const closest = extractClosestEdge(payload)
      return closest === 'left' || closest === 'right' ? closest : undefined
    }
    return combine(
      draggable({
        element: target,
        getInitialData: () => data,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: target,
        canDrop: ({ source }) => {
          const id = columnIdOf(source.data)
          return id !== undefined && id !== columnId
        },
        getData: ({ input }) =>
          attachClosestEdge(data, { input, element: target, allowedEdges: ['left', 'right'] }),
        onDrag: ({ self }) => setEdge(edgeOf(self.data)),
        onDragLeave: () => setEdge(undefined),
        onDrop: () => setEdge(undefined),
      }),
    )
  }, [element, columnId, enabled])
  return { dragging, edge }
}

export function useColumnDropMonitor(grid: Grid): void {
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => columnIdOf(source.data) !== undefined,
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0]
          const sourceId = columnIdOf(source.data)
          const targetId = target === undefined ? undefined : columnIdOf(target.data)
          if (target === undefined || sourceId === undefined || targetId === undefined) return
          const edge = extractClosestEdge(target.data)
          const columns = grid.view.get().columns
          const from = columns.findIndex((state) => state.id === sourceId)
          const targetIndex = columns.findIndex((state) => state.id === targetId)
          if (from === -1 || targetIndex === -1) return
          const rtl = getComputedStyle(target.element).direction === 'rtl'
          const after = (edge === 'right') !== rtl
          let to = after ? targetIndex + 1 : targetIndex
          if (from < to) to -= 1
          grid.view.moveColumn(sourceId, to)
        },
      }),
    [grid],
  )
}
