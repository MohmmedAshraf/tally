import { createSchema } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { describeSchema } from './prompt.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account', aliases: ['customer'], description: 'Company name' },
    { id: 'notes', hidden: true },
    { id: 'mrr', label: 'MRR', type: 'currency', sortable: false },
    { id: 'summary', type: 'text', filterable: false, sortable: false, groupable: false },
  ],
})

describe('describeSchema', () => {
  it('lists visible columns with operators, aliases and limits', () => {
    const text = describeSchema(schema, {
      now: new Date('2026-03-01T23:30:00Z'),
      context: { locale: 'en-US', timeZone: 'America/New_York', numberingSystem: 'latn' },
      examples: ['mrr > 1k'],
    })
    expect(text).toContain('- account (text): Account')
    expect(text).toContain('  Company name')
    expect(text).toContain('  also called: customer')
    expect(text).toContain('operators: is, is not, contains')
    expect(text).not.toContain('notes')
    expect(text).toContain('- mrr (currency): MRR')
    expect(text).toContain('cannot sort')
    expect(text).toContain('- summary (text)\n  not filterable\n  cannot sort, cannot group')
    expect(text).toContain('Examples:\n- mrr > 1k')
    expect(text).toContain('Today is 2026-03-01.')
  })
})
