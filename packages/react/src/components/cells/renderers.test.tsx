import { act, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gridReady, renderTally, settle } from '../../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name', avatar: true, subtitle: 'domain' },
  { id: 'domain', label: 'Domain', hidden: true },
  { id: 'notes', label: 'Notes', wrap: true },
  { id: 'mrr', label: 'MRR', type: 'number', sparkline: 'trend', format: { signed: true } },
  { id: 'trend', label: 'Trend', hidden: true },
  { id: 'renewal', label: 'Renewal', type: 'date', relative: true },
  { id: 'plain', label: 'Plain', type: 'date' },
  { id: 'plan', label: 'Plan', type: 'enum', options: [{ value: 'pro' }] },
  { id: 'paid', label: 'Paid', type: 'bool' },
  { id: 'owner', label: 'Owner', type: 'person' },
  { id: 'health', label: 'Health', type: 'bar' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'site', label: 'Site', type: 'url' },
]

const rows = [
  {
    id: 1,
    name: 'Kite Supply',
    domain: 'kite.io',
    notes: 'Long form',
    mrr: 120,
    trend: [1, 4, 2],
    renewal: '2099-01-01',
    plain: '2026-05-01',
    plan: 'pro',
    paid: true,
    owner: 'Priya Reyes',
    health: 20,
    email: 'ops@kite.io',
    site: 'https://kite.io',
  },
  {
    id: 2,
    name: '',
    domain: null,
    notes: null,
    mrr: -5,
    trend: [1],
    renewal: null,
    plain: null,
    plan: 'other',
    paid: false,
    owner: null,
    health: 55,
    email: null,
    site: null,
  },
  {
    id: 3,
    name: 'Zero',
    domain: '',
    notes: 'x',
    mrr: 0,
    trend: ['a', 'b'],
    renewal: 'soon',
    plain: '2026-01-01',
    plan: null,
    paid: null,
    owner: 'Solo',
    health: 90,
    email: 'zero@x.io',
    site: 'https://zero.io',
  },
]

function cellOf(row: number, column: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-row-index="${row}"][data-column="${column}"]`,
  )
  if (element === null) throw new Error(`missing ${row}:${column}`)
  return element
}

describe('default renderers', () => {
  it('renders text with avatar tiles, subtitles and wrapping', async () => {
    renderTally({ columns, rows, props: { initialSize: { width: 4000, height: 600 } } })
    await gridReady('Kite Supply')
    const name = cellOf(0, 'name')
    expect(within(name).getByText('KS')).toHaveClass('tally-tile')
    expect(within(name).getByText('kite.io')).toHaveClass('tally-sub')
    expect(cellOf(1, 'name').querySelector('.tally-tile')).toBeNull()
    expect(cellOf(2, 'name').querySelector('.tally-sub')).toBeNull()
    expect(within(cellOf(0, 'notes')).getByText('Long form')).toHaveAttribute('data-wrap')
  })

  it('renders numbers with sparklines and signs only for valid series', async () => {
    renderTally({ columns, rows, props: { initialSize: { width: 4000, height: 600 } } })
    await gridReady('Kite Supply')
    expect(cellOf(0, 'mrr').querySelector('.tally-spark')).toHaveAttribute('data-sign', 'up')
    expect(cellOf(0, 'mrr').querySelector('path')?.getAttribute('d')).toMatch(/^M0\.0 /)
    expect(cellOf(1, 'mrr').querySelector('.tally-spark')).toBeNull()
    expect(cellOf(2, 'mrr').querySelector('.tally-spark')).toBeNull()
  })

  it('renders relative dates, pills, booleans, people, meters and links', async () => {
    renderTally({ columns, rows, props: { initialSize: { width: 4000, height: 600 } } })
    await gridReady('Kite Supply')
    expect(cellOf(0, 'renewal').querySelector('.tally-sub')).not.toHaveAttribute('data-soon')
    expect(cellOf(1, 'renewal').querySelector('.tally-sub')).toBeNull()
    expect(cellOf(0, 'plain').querySelector('.tally-sub')).toBeNull()
    expect(cellOf(0, 'plan').querySelector('.tally-pill')).not.toHaveAttribute('data-color')
    expect(cellOf(2, 'plan').querySelector('.tally-pill')).toBeNull()
    expect(cellOf(0, 'paid').querySelector('.tally-bool svg')).not.toBeNull()
    expect(cellOf(1, 'paid').querySelector('.tally-bool')).toHaveAttribute('data-off')
    expect(cellOf(2, 'paid').querySelector('.tally-bool')).toBeNull()
    expect(within(cellOf(2, 'owner')).getByText('S')).toHaveClass('tally-avatar')
    expect(cellOf(1, 'owner').querySelector('.tally-avatar')).toBeNull()
    expect(cellOf(0, 'health').querySelector('.tally-meter')).toHaveStyle({
      '--tally-meter-color': 'var(--tally-down)',
    })
    expect(cellOf(1, 'health').querySelector('.tally-meter')).toHaveStyle({
      '--tally-meter-color': 'var(--tally-warn)',
    })
    expect(cellOf(2, 'health').querySelector('.tally-meter')?.getAttribute('style')).not.toContain(
      'meter-color',
    )
    expect(within(cellOf(0, 'email')).getByRole('link')).toHaveAttribute(
      'href',
      'mailto:ops@kite.io',
    )
    expect(within(cellOf(0, 'email')).getByRole('link')).not.toHaveAttribute('target')
    expect(cellOf(1, 'email').querySelector('a')).toBeNull()
  })

  it('lets hosts override renderers by type name', async () => {
    renderTally({
      columns,
      rows,
      props: {
        initialSize: { width: 4000, height: 600 },
        renderers: { email: ({ text }) => <b>custom {text}</b> },
      },
    })
    await gridReady('Kite Supply')
    expect(within(cellOf(0, 'email')).getByText('custom ops@kite.io')).toBeInTheDocument()
  })
})

describe('cards', () => {
  it('uses avatars and subtitles in card titles and the detail sheet', async () => {
    renderTally({ columns, rows, props: { layout: 'cards' } })
    const card = await screen.findByRole('article', { name: 'Kite Supply' })
    expect(within(card).getByText('KS')).toHaveClass('tally-tile')
    expect(within(card).getByText('kite.io')).toHaveClass('tally-sub')
    expect(card.querySelector('[data-block]')).not.toBeNull()
    act(() => within(card).getByRole('button', { name: 'Open Kite Supply' }).click())
    const sheet = await screen.findByRole('dialog', { name: /Kite Supply/ })
    expect(within(sheet).getByText('kite.io')).toHaveClass('tally-sub')
    expect(sheet.querySelector('.tally-detail-hero')).not.toBeNull()
  })

  it('renders a custom detail and plain titles when detail is disabled', async () => {
    const view = renderTally({
      columns,
      rows,
      props: {
        layout: 'cards',
        detail: ({ item, close }) => (
          <button type="button" onClick={close}>
            Done with {String(item.key)}
          </button>
        ),
      },
    })
    const card = await screen.findByRole('article', { name: 'Kite Supply' })
    act(() => within(card).getByRole('button', { name: 'Open Kite Supply' }).click())
    fireEvent.click(await screen.findByRole('button', { name: 'Done with 1' }))
    await settle()
    view.unmount()
    renderTally({ columns, rows, props: { layout: 'cards', detail: false } })
    const plain = await screen.findByRole('article', { name: 'Kite Supply' })
    expect(within(plain).queryByRole('button', { name: 'Open Kite Supply' })).toBeNull()
  })

  it('shows groups inside the card list', async () => {
    const harness = renderTally({ columns, rows, props: { layout: 'cards' } })
    await screen.findByRole('article', { name: 'Kite Supply' })
    act(() => harness.grid().view.setGroup('paid'))
    await settle()
    expect(document.querySelectorAll('.tally-cards .tally-group[data-plain]').length).toBe(3)
    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(harness.source().rows()).toHaveLength(3)
  })
})
