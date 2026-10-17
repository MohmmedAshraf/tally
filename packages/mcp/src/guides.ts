export const GUIDE_SOURCES: Readonly<Record<string, string>> = {
  overview: '../../README.md',
  core: '../core/README.md',
  react: '../react/README.md',
  protocol: '../protocol/README.md',
  server: '../server/README.md',
  php: '../php/README.md',
  adapters: '../adapters/README.md',
  ai: '../ai/README.md',
}

export const GUIDE_TITLES: Readonly<Record<string, string>> = {
  overview: 'Packages and how they fit together',
  core: 'tally-core: schema, column types, query language, views, executor, mutations',
  react: 'tally-react: the component, hooks, renderers, editors, labels, intents, styling',
  protocol: 'tally-protocol: wire schemas, validation, JSON Schema, conformance suite',
  server: 'tally-server: Kysely SQL adapter, dialects, Fetch handler, SSE',
  php: 'tally/laravel: grid classes, Route::tally(), Eloquent query compiler, dialects',
  adapters: 'tally-adapters: HTTP, TanStack Query, TanStack DB and Supabase sources',
  ai: 'tally-ai: natural language to query, AI columns, column design',
  extend: 'Where each kind of change goes',
}

export type Guides = Readonly<Record<string, string>>

export interface GuideSection {
  readonly guide: string
  readonly heading: string
  readonly text: string
}

export function sectionsOf(guides: Guides): readonly GuideSection[] {
  const sections: GuideSection[] = []
  for (const [guide, markdown] of Object.entries(guides)) {
    let heading = GUIDE_TITLES[guide] ?? guide
    let lines: string[] = []
    const flush = (): void => {
      const text = lines.join('\n').trim()
      if (text !== '') sections.push({ guide, heading, text })
      lines = []
    }
    for (const line of markdown.split('\n')) {
      const match = /^#{1,3}\s+(.+)$/.exec(line)
      if (match?.[1] !== undefined) {
        flush()
        heading = match[1].trim()
        continue
      }
      lines.push(line)
    }
    flush()
  }
  return sections
}

export function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

export function searchSections(
  sections: readonly GuideSection[],
  query: string,
  limit = 5,
): readonly GuideSection[] {
  const terms = [...new Set(tokenize(query))]
  if (terms.length === 0) return []
  return sections
    .map((section) => {
      const haystack = tokenize(`${section.heading} ${section.text}`)
      const headingTokens = new Set(tokenize(section.heading))
      let score = 0
      for (const term of terms) {
        const hits = haystack.filter((token) => token === term || token.startsWith(term)).length
        if (hits === 0) continue
        score += 1 + Math.min(hits, 5) * 0.2 + (headingTokens.has(term) ? 2 : 0)
      }
      return { section, score }
    })
    .filter((entry) => entry.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.section)
}
