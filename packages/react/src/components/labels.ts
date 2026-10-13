import { createContext, useContext, type Context } from 'react'

export interface TallyLabels {
  readonly filter: string
  readonly filterPlaceholder: string
  readonly askPlaceholder: string
  readonly ask: string
  readonly apply: string
  readonly discard: string
  readonly editAsText: string
  readonly undo: string
  readonly redo: string
  readonly display: string
  readonly rows: (count: number) => string
  readonly selected: (count: number) => string
  readonly removeFilter: (text: string) => string
}

export const defaultLabels: TallyLabels = {
  filter: 'Filter',
  filterPlaceholder: 'Filter…',
  askPlaceholder: 'Ask…',
  ask: 'Ask',
  apply: 'Apply',
  discard: 'Discard',
  editAsText: 'Edit as text',
  undo: 'Undo',
  redo: 'Redo',
  display: 'Display',
  rows: (count) => `${count.toLocaleString()} rows`,
  selected: (count) => `${count.toLocaleString()} selected`,
  removeFilter: (text) => `Remove ${text}`,
}

export const LabelsContext: Context<TallyLabels> = createContext<TallyLabels>(defaultLabels)

export function useLabels(): TallyLabels {
  return useContext(LabelsContext)
}
