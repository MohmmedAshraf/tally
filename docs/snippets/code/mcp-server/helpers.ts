import { findExtensionPoints, parseQueryText, type ParsedQuery } from 'tally-mcp-server'

export const points: readonly string[] = findExtensionPoints('show a ring instead of a number').map(
  (point) => point.id,
)

export const parsed: ParsedQuery = parseQueryText('mrr > 2k, sort by mrr desc', [
  { id: 'mrr', type: 'currency' },
])
