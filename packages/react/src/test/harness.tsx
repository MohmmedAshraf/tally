import { act, render, screen, within, type RenderResult } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import {
  createArraySource,
  createSchema,
  type ArraySource,
  type ArraySourceOptions,
  type ColumnInput,
  type DataSource,
  type Grid,
  type RowData,
} from 'tally-core'
import { useGrid } from '../hooks/use-grid.ts'
import { Tally, type TallyProps } from '../components/tally.tsx'

export interface HarnessOptions {
  readonly columns: readonly ColumnInput[]
  readonly parent?: string | undefined
  readonly rows?: readonly RowData[] | undefined
  readonly source?: ArraySourceOptions | undefined
  readonly createSource?: ((rows: readonly RowData[]) => DataSource) | undefined
  readonly pageSize?: number | undefined
  readonly props?: Partial<Omit<TallyProps, 'grid'>> | undefined
}

export interface Harness extends RenderResult {
  readonly grid: () => Grid
  readonly source: () => ArraySource
}

interface Mounted {
  grid?: Grid
}

export function renderTally(options: HarnessOptions): Harness {
  const schema = createSchema({ columns: options.columns, parent: options.parent })
  const rows = options.rows ?? []
  const mounted: Mounted = {}
  const array = createArraySource(rows, schema, options.source)
  const source = options.createSource?.(rows) ?? array
  function Host(): ReactNode {
    const created = useGrid({
      schema,
      source,
      pageSize: options.pageSize,
      format: { locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' },
    })
    useEffect(() => {
      mounted.grid = created
    }, [created])
    return <Tally grid={created} initialSize={{ width: 1200, height: 600 }} {...options.props} />
  }
  const result = render(<Host />)
  return {
    ...result,
    grid: () => {
      if (mounted.grid === undefined) throw new Error('grid not mounted')
      return mounted.grid
    },
    source: () => {
      if (source !== array) throw new Error('custom sources are not array sources')
      return array
    },
  }
}

export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

export function cellAt(row: number, column: number): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-row-index="${row}"][data-col-index="${column}"]`,
  )
  if (element === null) throw new Error(`missing cell ${row}:${column}`)
  return element
}

export async function gridReady(text: string): Promise<HTMLElement> {
  const grid = screen.getByRole('grid')
  await within(grid).findByText(text)
  return grid
}
