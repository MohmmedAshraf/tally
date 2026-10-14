import type { LucideIcon } from 'lucide-react'
import type { Density, RowData, Schema } from 'tally-core'

export interface SavedView {
  readonly name: string
  readonly query: string
}

export interface Dataset {
  readonly id: string
  readonly title: string
  readonly unit: string
  readonly icon: LucideIcon
  readonly schema: Schema
  readonly rows: readonly RowData[]
  readonly views: readonly SavedView[]
  readonly examples: readonly string[]
  readonly aiColumns?: readonly string[] | undefined
  readonly density?: Density | undefined
  readonly remote: boolean
  readonly live?: boolean | undefined
  readonly simulate?: boolean | undefined
}
