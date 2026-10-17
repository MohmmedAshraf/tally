import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { columnLabel, printFilter, type Grid, type GridState, type Mutation } from 'tally-core'
import { useLabels, type TallyLabels } from './labels.ts'

type Message = (labels: TallyLabels) => string

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

function idsOf(history: readonly Mutation[]): ReadonlySet<string> {
  return new Set(history.map((mutation) => mutation.id))
}

export function Announcer({ grid }: { readonly grid: Grid }): ReactNode {
  const labels = useLabels()
  const [message, setMessage] = useState('')
  const say = useEffectEvent((build: Message): void => {
    const text = build(labels)
    setMessage((previous) => (previous === text ? `${text} ` : text))
  })

  useEffect(() => {
    const nameOf = (id: string): string => {
      const column = grid.schema.column(id)
      return column === undefined ? id : columnLabel(column)
    }
    let view = grid.view.get()
    let loaded = false
    let pending: Message[] = []
    let queried = false
    let selected = grid.selection.get().rows.size
    let position = grid.rows.position()
    let known = idsOf(grid.rows.history())

    const flush = (state: GridState): void => {
      if (state.status === 'loading') {
        queried = true
        if (pending.length > 0) say((text) => text.loading)
        return
      }
      const matched = state.matched ?? state.total
      if (state.status !== 'ready' || matched === undefined || !queried) return
      if (pending.length === 0 && loaded) return
      loaded = true
      queried = false
      const parts = pending
      pending = []
      say((text) => [...parts.map((part) => part(text)), text.rows(matched)].join('. '))
    }

    const stopView = grid.view.subscribe((next) => {
      const { sort, filter } = next
      const group = next.group?.column
      if (!same(sort, view.sort)) {
        pending.push((text) =>
          text.sorted(
            sort.map((entry) => ({ column: nameOf(entry.column), direction: entry.direction })),
          ),
        )
      }
      if (group !== view.group?.column) {
        pending.push((text) => text.grouped(group === undefined ? undefined : nameOf(group)))
      }
      if (!same(filter, view.filter)) {
        pending.push((text) =>
          text.filtered(filter === undefined ? undefined : printFilter(filter, grid.schema)),
        )
      }
      view = next
      if (pending.length > 0) queried = false
    })

    const stopState = grid.subscribe(flush)

    const stopSelection = grid.selection.subscribe((state) => {
      if (state.rows.size === selected) return
      selected = state.rows.size
      const count = selected
      say((text) => text.selected(count))
    })

    const stopRows = grid.rows.subscribe(() => {
      const last = position
      const lastKnown = known
      const entries = grid.rows.history()
      position = grid.rows.position()
      known = idsOf(entries)
      const top = entries[position - 1]
      if (position < last) {
        const undone = entries[position]
        if (undone !== undefined) say((text) => text.undone(undone.label))
      } else if (top !== undefined && !lastKnown.has(top.id)) {
        say(() => top.label)
      } else if (position > last && top !== undefined) {
        say((text) => text.redone(top.label))
      }
    })

    return () => {
      stopView()
      stopState()
      stopSelection()
      stopRows()
    }
  }, [grid])

  return (
    <div className="tally-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
