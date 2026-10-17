import { createContext, useContext, type Context } from 'react'
import { defaultFormatContext, numberFormatter, type FormatContext } from 'tally-core'

export interface SortAnnouncement {
  readonly column: string
  readonly direction: 'asc' | 'desc'
}

export interface TallyLabels {
  readonly filter: string
  readonly filterPlaceholder: string
  readonly askPlaceholder: string
  readonly asking: string
  readonly ai: string
  readonly addAiColumn: string
  readonly aiColumnPlaceholder: string
  readonly add: string
  readonly editAsText: string
  readonly undo: string
  readonly redo: string
  readonly display: string
  readonly density: string
  readonly densities: Readonly<Record<'compact' | 'comfortable' | 'spacious', string>>
  readonly columns: string
  readonly sortAZ: string
  readonly sortZA: string
  readonly sortHighLow: string
  readonly sortLowHigh: string
  readonly addToSort: string
  readonly addToSortHint: string
  readonly fitWidthHint: string
  readonly uniqueValues: (count: number) => string
  readonly typeName: (type: string) => string
  readonly ungroup: string
  readonly pinLeft: string
  readonly pinRight: string
  readonly unpin: string
  readonly pin: string
  readonly pinned: string
  readonly hideColumn: string
  readonly fitWidth: string
  readonly fillWidth: string
  readonly footer: string
  readonly none: string
  readonly resizeColumn: (column: string) => string
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
  readonly deleteRowsTitle: (count: number) => string
  readonly cancel: string
  readonly empty: string
  readonly emptyGroup: string
  readonly toggleGroup: string
  readonly noMatches: string
  readonly noMatchesDetail: (query: string) => string
  readonly clearFilter: string
  readonly noColumns: string
  readonly showAllColumns: string
  readonly retry: string
  readonly pages: string
  readonly previousPage: string
  readonly nextPage: string
  readonly columnMenu: (column: string) => string
  readonly groupBy: (column: string) => string
  readonly filterBy: (column: string) => string
  readonly rows: (count: number) => string
  readonly pageRange: (from: number, to: number, total: number) => string
  readonly groupRange: (from: number, to: number, total: number) => string
  readonly selected: (count: number) => string
  readonly removeFilter: (text: string) => string
  readonly selectRow: (title: string) => string
  readonly selectRowAt: (position: number) => string
  readonly selectAllRows: string
  readonly toggleRow: string
  readonly tint: (id: string) => string
  readonly loading: string
  readonly sorted: (sorts: readonly SortAnnouncement[]) => string
  readonly grouped: (column: string | undefined) => string
  readonly filtered: (filter: string | undefined) => string
  readonly undone: (action: string) => string
  readonly redone: (action: string) => string
  readonly openRow: (title: string) => string
  readonly close: string
}

const TINT_NAMES: Readonly<Record<string, string>> = {
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
  bold: 'Bold',
}

const TYPE_NAMES: Readonly<Record<string, string>> = {
  text: 'Text',
  enum: 'Category',
  currency: 'Currency',
  int: 'Integer',
  number: 'Decimal',
  percent: 'Percent',
  bar: 'Score 0–100',
  date: 'Date',
  bool: 'Boolean',
  email: 'Email',
  url: 'URL',
  id: 'Identifier',
  person: 'Person',
  duration: 'Duration',
}

export function localizedLabels(format: FormatContext): TallyLabels {
  const numeral = (value: number): string => numberFormatter(format, {}).format(value)
  return {
    filter: 'Filter',
    filterPlaceholder: 'Filter…',
    askPlaceholder: 'Filter or ask anything…',
    asking: 'Asking',
    ai: 'AI',
    addAiColumn: 'Add an AI column',
    aiColumnPlaceholder: 'What should it work out per row?',
    add: 'Add',
    editAsText: 'Edit as text',
    undo: 'Undo',
    redo: 'Redo',
    display: 'Display',
    density: 'Row height',
    densities: { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' },
    columns: 'Columns',
    sortAZ: 'Sort A to Z',
    sortZA: 'Sort Z to A',
    sortHighLow: 'Sort high to low',
    sortLowHigh: 'Sort low to high',
    addToSort: 'Add to sort',
    addToSortHint: '⇧ click',
    fitWidthHint: 'dbl-click edge',
    uniqueValues: (count) => `${numeral(count)} unique values`,
    typeName: (type) => TYPE_NAMES[type] ?? type,
    ungroup: 'Ungroup',
    pinLeft: 'Pin left',
    pinRight: 'Pin right',
    unpin: 'Unpin',
    pin: 'Pin',
    pinned: 'Pinned',
    hideColumn: 'Hide column',
    fitWidth: 'Fit width',
    fillWidth: 'Fill remaining width',
    footer: 'Footer',
    none: 'None',
    resizeColumn: (column) => `Resize ${column}`,
    addRow: 'Add row',
    formattingRules: 'Formatting rules',
    addRule: 'Add rule',
    removeRule: 'Remove rule',
    operator: 'Operator',
    value: 'Value',
    style: 'Style',
    copy: 'Copy',
    pinRow: (count) => (count > 1 ? `Pin ${numeral(count)} rows` : 'Pin row'),
    unpinRow: (count) => (count > 1 ? `Unpin ${numeral(count)} rows` : 'Unpin row'),
    deleteRows: (count) => (count > 1 ? `Delete ${numeral(count)} rows` : 'Delete row'),
    deleteRowsTitle: (count) => (count > 1 ? `Delete ${numeral(count)} rows?` : 'Delete this row?'),
    cancel: 'Cancel',
    empty: 'No rows',
    emptyGroup: 'Empty',
    toggleGroup: 'Toggle group',
    noMatches: 'No rows match',
    noMatchesDetail: (query) => `Nothing fits “${query}”. Loosen a condition or clear the filter.`,
    clearFilter: 'Clear filter',
    noColumns: 'No visible columns',
    showAllColumns: 'Show all columns',
    retry: 'Retry',
    pages: 'Pages',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    columnMenu: (column) => `${column} options`,
    groupBy: (column) => `Group by ${column}`,
    filterBy: (column) => `Filter by ${column}`,
    rows: (count) => `${numeral(count)} rows`,
    pageRange: (from, to, total) => `${numeral(from)}–${numeral(to)} of ${numeral(total)}`,
    groupRange: (from, to, total) => `${numeral(from)}–${numeral(to)} of ${numeral(total)} groups`,
    selected: (count) => `${numeral(count)} selected`,
    removeFilter: (text) => `Remove ${text}`,
    selectRow: (title) => `Select ${title}`,
    selectRowAt: (position) => `Select row ${numeral(position)}`,
    selectAllRows: 'Select all rows',
    toggleRow: 'Toggle row',
    tint: (id) => TINT_NAMES[id] ?? id,
    loading: 'Loading',
    sorted: (sorts) =>
      sorts.length === 0
        ? 'Sort cleared'
        : `Sorted by ${sorts
            .map(
              (sort) => `${sort.column} ${sort.direction === 'asc' ? 'ascending' : 'descending'}`,
            )
            .join(', ')}`,
    grouped: (column) => (column === undefined ? 'Ungrouped' : `Grouped by ${column}`),
    filtered: (filter) => (filter === undefined ? 'Filter cleared' : `Filtered by ${filter}`),
    undone: (action) => `Undid ${action}`,
    redone: (action) => `Redid ${action}`,
    openRow: (title) => `Open ${title}`,
    close: 'Close',
  }
}

export const defaultLabels: TallyLabels = localizedLabels(defaultFormatContext)

export const LabelsContext: Context<TallyLabels> = createContext<TallyLabels>(defaultLabels)

export function useLabels(): TallyLabels {
  return useContext(LabelsContext)
}
