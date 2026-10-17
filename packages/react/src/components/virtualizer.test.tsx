import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type * as ReactVirtual from '@tanstack/react-virtual'
import { gridReady, renderTally } from '../test/harness.tsx'

const keyFns = vi.hoisted((): unknown[] => [])

vi.mock('@tanstack/react-virtual', async (load) => {
  const actual = await load<typeof ReactVirtual>()
  return {
    ...actual,
    useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) => {
      if (options.horizontal !== true) keyFns.push(options.getItemKey)
      return actual.useVirtualizer(options)
    },
  }
})

describe('row virtualizer', () => {
  it('keeps item keys stable while scrolling so measurements are not rebuilt', async () => {
    const rows = Array.from({ length: 400 }, (_, index) => ({ id: index, name: `Row ${index}` }))
    renderTally({ columns: [{ id: 'name', label: 'Name' }], rows })
    await gridReady('Row 0')
    const settled = keyFns.length
    const viewport = screen.getByRole('grid')
    await act(async () => {
      for (const top of [96, 192, 288]) {
        viewport.scrollTop = top
        fireEvent.scroll(viewport)
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(keyFns.length).toBeGreaterThan(settled)
    expect(new Set(keyFns.slice(settled - 1)).size).toBe(1)
  })
})
