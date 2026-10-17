import { describe, expect, it } from 'vitest'
import { EXTENSION_POINTS, findExtensionPoints, renderExtensionPoints } from './extension-points.ts'
import { GUIDE_SOURCES } from './guides.ts'

describe('EXTENSION_POINTS', () => {
  it('has unique ids that point at shipped guides', () => {
    const ids = EXTENSION_POINTS.map((point) => point.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const point of EXTENSION_POINTS) expect(GUIDE_SOURCES).toHaveProperty(point.guide)
  })
})

describe('findExtensionPoints', () => {
  it('returns nothing without searchable terms', () => {
    expect(findExtensionPoints('')).toEqual([])
    expect(findExtensionPoints('xyzzy plugh')).toEqual([])
  })

  it('matches prefixes and caps the result', () => {
    expect(findExtensionPoints('rend', 1).map((point) => point.id)).toEqual(['renderer'])
  })

  it('scores multi word keywords on the raw phrase', () => {
    const phrase = EXTENSION_POINTS.flatMap((point) =>
      point.keywords
        .filter((keyword) => keyword.includes(' '))
        .map((keyword) => ({ point, keyword })),
    )[0]
    expect(phrase).toBeDefined()
    if (phrase === undefined) return
    expect(findExtensionPoints(phrase.keyword).map((point) => point.id)).toContain(phrase.point.id)
  })
})

describe('renderExtensionPoints', () => {
  it('renders every point as a section', () => {
    const markdown = renderExtensionPoints()
    for (const point of EXTENSION_POINTS) expect(markdown).toContain(`## ${point.title}`)
  })
})
