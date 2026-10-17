import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gridReady, renderTally, settle } from '../test/harness.tsx'
import type { AskHandler } from './toolbar/filter-bar.tsx'
import { flash } from './motion.ts'

const reduced = window.matchMedia

function allowMotion(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query }),
  })
}

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'summary', label: 'Summary', ai: true },
]

const rows = [
  { id: 1, name: 'One' },
  { id: 2, name: 'Two', summary: 'Ready' },
]

describe('motion', () => {
  beforeEach(allowMotion)
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: reduced })
  })

  it('shows a skeleton for pending ai cells and decodes the value when it arrives', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    const pending = document.querySelector('[data-row-index="0"][data-column="summary"]')
    expect(pending?.querySelector('.tally-skeleton')).not.toBeNull()
    expect(
      document.querySelector('.tally-header-cell[data-column="summary"] .tally-header-ai'),
    ).not.toBeNull()
    act(() => harness.source().patch({ upserts: [{ id: 1, name: 'One', summary: 'Healthy' }] }))
    await waitFor(() =>
      expect(document.querySelector('[data-row-index="0"] .tally-decode')).not.toBeNull(),
    )
    await waitFor(
      () => expect(document.querySelector('[data-row-index="0"] .tally-decode')).toBeNull(),
      { timeout: 2000 },
    )
    expect(screen.getByText('Healthy')).toBeDefined()
  })

  it('animates the toolbar count between values', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    expect(screen.getByText('2 rows')).toBeInTheDocument()
    act(() => harness.grid().selection.dispatch({ type: 'selectRows', keys: [1] }))
    await screen.findByText('1 selected', {}, { timeout: 2000 })
  })

  it('flashes the reveal attribute after an answered question', async () => {
    const ask = vi.fn<AskHandler>().mockResolvedValue({ query: { sort: [], filter: undefined } })
    renderTally({ columns, rows, props: { ai: { ask } } })
    await gridReady('One')
    const input = screen.getByRole('combobox', { name: 'Filter' })
    fireEvent.change(input, { target: { value: 'who is ready now' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    await waitFor(() => expect(document.querySelector('.tally')).toHaveAttribute('data-reveal'), {
      timeout: 2000,
    })
  })

  it('skips flashing missing elements', () => {
    expect(() => flash(null, 'data-x', 10)).not.toThrow()
  })
})
