import { act, createEvent, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gridReady, renderTally, settle } from '../test/harness.tsx'

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'plan', label: 'Plan' },
  { id: 'mrr', label: 'MRR', type: 'number' },
]

const rows = [{ id: 1, name: 'One', plan: 'pro', mrr: 1 }]

function header(id: string): HTMLElement {
  return document.querySelector<HTMLElement>(`.tally-header-cell[data-column="${id}"]`)!
}

type DragName = 'dragStart' | 'dragEnter' | 'dragOver' | 'drop'

function dispatch(
  name: DragName,
  element: HTMLElement,
  dataTransfer: object,
  clientX: number,
): void {
  const event = createEvent[name](element, { dataTransfer })
  Object.defineProperty(event, 'clientX', { value: clientX })
  Object.defineProperty(event, 'clientY', { value: 10 })
  fireEvent(element, event)
}

function rect(element: HTMLElement, left: number): void {
  element.getBoundingClientRect = () => new DOMRect(left, 0, 100, 30)
}

async function drag(from: string, to: string, clientX: number): Promise<void> {
  const transfer = {
    types: [] as string[],
    setData() {},
    getData: () => '',
    setDragImage() {},
    dropEffect: 'move',
    effectAllowed: 'move',
    items: [],
    files: [],
  }
  const source = header(from)
  const target = header(to)
  rect(source, 0)
  rect(target, 200)
  act(() => dispatch('dragStart', source, transfer, 50))
  await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
  act(() => {
    dispatch('dragEnter', target, transfer, clientX)
    dispatch('dragOver', target, transfer, clientX)
  })
  await settle()
  expect(header(from)).toHaveAttribute('data-dragging')
  expect(header(to)).toHaveAttribute('data-drop-edge', clientX > 250 ? 'right' : 'left')
  act(() => dispatch('drop', target, transfer, clientX))
  await settle()
}

describe('column drag', () => {
  it('moves a column after the target when dropped on its right edge', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    await drag('name', 'mrr', 290)
    expect(
      harness
        .grid()
        .view.get()
        .columns.map((column) => column.id),
    ).toEqual(['plan', 'mrr', 'name'])
  })

  it('moves a column before the target when dropped on its left edge', async () => {
    const harness = renderTally({ columns, rows })
    await gridReady('One')
    await drag('mrr', 'name', 210)
    expect(
      harness
        .grid()
        .view.get()
        .columns.map((column) => column.id),
    ).toEqual(['mrr', 'name', 'plan'])
  })
})
