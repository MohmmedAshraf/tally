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
  readonly density: string
  readonly densities: Readonly<Record<'compact' | 'comfortable' | 'spacious', string>>
  readonly columns: string
  readonly sortAscending: string
  readonly sortDescending: string
  readonly ungroup: string
  readonly pinLeft: string
  readonly pinRight: string
  readonly unpin: string
  readonly hideColumn: string
  readonly footer: string
  readonly none: string
  readonly resizeColumn: string
  readonly addRow: string
  readonly formattingRules: string
  readonly addRule: string
  readonly removeRule: string
  readonly operator: string
  readonly value: string
  readonly style: string
  readonly copy: string
  readonly pinRow: (count: number) => string
  readonly unpinRow: (count: number) => string
  readonly deleteRows: (count: number) => string
  readonly pages: string
  readonly previousPage: string
  readonly nextPage: string
  readonly columnMenu: (column: string) => string
  readonly groupBy: (column: string) => string
  readonly filterBy: (column: string) => string
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
  density: 'Row height',
  densities: { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' },
  columns: 'Columns',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  ungroup: 'Ungroup',
  pinLeft: 'Pin left',
  pinRight: 'Pin right',
  unpin: 'Unpin',
  hideColumn: 'Hide column',
  footer: 'Footer',
  none: 'None',
  resizeColumn: 'Resize column',
  addRow: 'Add row',
  formattingRules: 'Formatting rules',
  addRule: 'Add rule',
  removeRule: 'Remove rule',
  operator: 'Operator',
  value: 'Value',
  style: 'Style',
  copy: 'Copy',
  pinRow: (count) => (count > 1 ? `Pin ${count} rows` : 'Pin row'),
  unpinRow: (count) => (count > 1 ? `Unpin ${count} rows` : 'Unpin row'),
  deleteRows: (count) => (count > 1 ? `Delete ${count} rows` : 'Delete row'),
  pages: 'Pages',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  columnMenu: (column) => `${column} options`,
  groupBy: (column) => `Group by ${column}`,
  filterBy: (column) => `Filter by ${column}`,
  rows: (count) => `${count.toLocaleString()} rows`,
  selected: (count) => `${count.toLocaleString()} selected`,
  removeFilter: (text) => `Remove ${text}`,
}

export const LabelsContext: Context<TallyLabels> = createContext<TallyLabels>(defaultLabels)

export function useLabels(): TallyLabels {
  return useContext(LabelsContext)
}
