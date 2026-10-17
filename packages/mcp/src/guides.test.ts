import { describe, expect, it } from 'vitest'
import { GUIDE_TITLES, searchSections, sectionsOf, tokenize } from './guides.ts'

describe('sectionsOf', () => {
  it('splits markdown by heading and titles the preamble', () => {
    const sections = sectionsOf({
      core: 'Intro text\n# Schema\nColumns live here\n## Empty\n### Views\nSaved views',
      notes: 'Loose notes',
    })
    expect(sections).toEqual([
      { guide: 'core', heading: GUIDE_TITLES['core'], text: 'Intro text' },
      { guide: 'core', heading: 'Schema', text: 'Columns live here' },
      { guide: 'core', heading: 'Views', text: 'Saved views' },
      { guide: 'notes', heading: 'notes', text: 'Loose notes' },
    ])
  })
})

describe('tokenize', () => {
  it('lowercases and drops single characters', () => {
    expect(tokenize('Sort BY a mrr-desc')).toEqual(['sort', 'by', 'mrr', 'desc'])
  })
})

describe('searchSections', () => {
  const sections = sectionsOf({
    core: '# Sorting\nsort rows by a column\n# Filters\nfilter rows, sort later\n# Other\nnothing',
  })

  it('ranks heading matches first and respects the limit', () => {
    expect(searchSections(sections, 'sort').map((section) => section.heading)).toEqual([
      'Sorting',
      'Filters',
    ])
    expect(searchSections(sections, 'sort', 1)).toHaveLength(1)
  })

  it('returns nothing for empty or unmatched queries', () => {
    expect(searchSections(sections, '?')).toEqual([])
    expect(searchSections(sections, 'zebra')).toEqual([])
  })
})
