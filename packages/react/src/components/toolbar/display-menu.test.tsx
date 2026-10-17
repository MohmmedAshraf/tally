import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gridReady, renderTally, settle } from '../../test/harness.tsx'

const columns = [
  { id: 'id', type: 'int', hidden: true },
  { id: 'name', label: 'Name' },
  { id: 'mrr', label: 'MRR', type: 'currency' },
  {
    id: 'plan',
    label: 'Plan',
    type: 'enum',
    options: [
      { value: 'pro', label: 'Pro' },
      { value: 'team', label: 'Team' },
    ],
  },
]

const rows = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `Account ${index + 1}`,
  mrr: (index + 1) * 1000,
  plan: index % 2 === 0 ? 'pro' : 'team',
}))

function captureDownload(): { readonly blobs: Blob[]; readonly names: string[] } {
  const blobs: Blob[] = []
  const names: string[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (blob instanceof Blob) blobs.push(blob)
    return 'blob:tally'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download)
  })
  return { blobs, names }
}

async function openDisplay(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Display' }))
  return screen.findByRole('dialog', { name: 'Display' })
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) throw new Error('missing file input')
  return input
}

function upload(text: string): void {
  fireEvent.change(fileInput(), {
    target: { files: [new File([text], 'rows.csv', { type: 'text/csv' })] },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DisplayMenu CSV', () => {
  it('exports every matched row across pages with raw values and visible columns', async () => {
    const download = captureDownload()
    const harness = renderTally({
      columns,
      rows,
      pageSize: 2,
      source: { pagination: 'offset' },
      props: { label: 'Accounts' },
    })
    await gridReady('Account 1')
    harness.grid().view.setFilter({ type: 'condition', column: 'plan', op: 'eq', value: 'pro' })
    harness.grid().view.setColumnHidden('plan', true)
    await settle()
    const popup = await openDisplay()
    fireEvent.click(within(popup).getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(download.blobs).toHaveLength(1))
    expect(download.names).toEqual(['Accounts.csv'])
    expect(await download.blobs[0]?.text()).toBe(
      'Name,MRR\nAccount 1,1000\nAccount 3,3000\nAccount 5,5000',
    )
  })

  it('imports rows as one undoable mutation and announces it', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('Account 1')
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => undefined)
    const popup = await openDisplay()
    fireEvent.click(within(popup).getByRole('button', { name: 'Import CSV' }))
    expect(click).toHaveBeenCalled()
    upload('id,Name,MRR,Plan\n1,Imported one,"1,500",Team\n,Imported two,20,pro\n')
    await screen.findByText('Imported one')
    const grid = harness.grid()
    expect(grid.rows.rows()).toHaveLength(7)
    const imported = grid.rows.rows().slice(-2)
    expect(imported.map((row) => [row['name'], row['mrr'], row['plan']])).toEqual([
      ['Imported one', 1500, 'team'],
      ['Imported two', 20, 'pro'],
    ])
    expect(new Set(grid.rows.rows().map((row) => grid.schema.keyOf(row))).size).toBe(7)
    expect(screen.getByRole('status')).toHaveTextContent('Import 2 rows')
    fireEvent.click(screen.getByRole('button', { name: 'Undo Import 2 rows' }))
    await waitFor(() => expect(grid.rows.rows()).toHaveLength(5))
  })

  it('keeps unused ids and shows import problems in the banner', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('Account 1')
    upload('id,Name\n9,Solo\n')
    await screen.findByText('Solo')
    expect(harness.grid().rows.rows().at(-1)).toEqual({ id: 9, name: 'Solo' })
    upload('Name,MRR\nBroken,lots\n')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('"lots" is not a valid currency')
    fireEvent.click(within(alert).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).toBeNull()
    upload('Unknown\nvalue\n')
    expect(await screen.findByRole('alert')).toHaveTextContent('No CSV column matches the schema')
    upload('Name\n')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    fireEvent.change(fileInput(), { target: { files: [] } })
    expect(harness.grid().rows.rows()).toHaveLength(6)
  })

  it('surfaces rejected imports and hides import for read only sources', async () => {
    const harness = renderTally({
      columns,
      rows,
      createSource: (data) => ({
        capabilities: {
          filter: false,
          sort: false,
          group: false,
          search: false,
          aggregates: false,
          facets: false,
          pagination: 'none',
          mutate: true,
          live: false,
        },
        query: () => Promise.resolve({ rows: data, total: data.length }),
        mutate: () => Promise.resolve({ accepted: false, errors: [{ message: 'Quota reached' }] }),
      }),
    })
    await gridReady('Account 1')
    upload('Name\nLate\n')
    expect(await screen.findByRole('alert')).toHaveTextContent('Quota reached')
    expect(harness.grid().rows.rows()).toHaveLength(5)
    harness.unmount()
    renderTally({ columns, rows, source: { mutable: false } })
    await gridReady('Account 1')
    const popup = await openDisplay()
    expect(within(popup).queryByRole('button', { name: 'Import CSV' })).toBeNull()
  })
})
