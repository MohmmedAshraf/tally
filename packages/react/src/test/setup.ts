import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'

afterEach(cleanup)

const VIEWPORT = { width: 1200, height: 600 }

function stubSize(property: 'offsetWidth' | 'offsetHeight', size: number): void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList.contains('tally-viewport')) return size
      const measured: unknown = original?.get?.call(this)
      return typeof measured === 'number' ? measured : 0
    },
  })
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', { value: undefined, configurable: true })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: query.includes('reduced-motion'), media: query }),
  })
  stubSize('offsetWidth', VIEWPORT.width)
  stubSize('offsetHeight', VIEWPORT.height)
})
