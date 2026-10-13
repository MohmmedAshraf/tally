import { clampWidth, type Column } from 'tally-core'

const HEADER_CONTROLS_WIDTH = 29

function spacing(style: CSSStyleDeclaration, property: string): number {
  return Number.parseFloat(style.getPropertyValue(property)) || 0
}

function contentWidth(element: Element): number {
  const own = Math.max(element.scrollWidth, element.getBoundingClientRect().width)
  const inner = Array.from(element.children, (child) => child.scrollWidth)
  return Math.max(own, ...inner)
}

function cellWidth(cell: HTMLElement): number {
  const style = getComputedStyle(cell)
  const children = Array.from(cell.children).filter(
    (child) => getComputedStyle(child).position !== 'absolute',
  )
  const content = children.reduce((sum, child) => sum + contentWidth(child), 0)
  const gaps = spacing(style, 'column-gap') * Math.max(0, children.length - 1)
  return content + gaps + spacing(style, 'padding-left') + spacing(style, 'padding-right')
}

function matches(id: string): (element: HTMLElement) => boolean {
  return (element) => element.dataset['column'] === id
}

export function measureColumnWidth(root: HTMLElement, column: Column): number | undefined {
  const header = Array.from(root.querySelectorAll<HTMLElement>('.tally-header-cell')).find(
    matches(column.id),
  )
  if (header === undefined) return undefined
  const style = getComputedStyle(header)
  const label = header.querySelector('.tally-text')?.scrollWidth ?? 0
  let width =
    label + HEADER_CONTROLS_WIDTH + spacing(style, 'padding-left') + spacing(style, 'padding-right')
  const cells = Array.from(root.querySelectorAll<HTMLElement>('.tally-cell')).filter(
    matches(column.id),
  )
  for (const cell of cells) width = Math.max(width, cellWidth(cell))
  return clampWidth(column, Math.ceil(width))
}
