import type { LanguageModel } from 'ai'
import { createSchema } from 'tally-core'
import { ask, type AskResult } from 'tally-ai'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'plan', type: 'enum', options: [{ value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', type: 'date' },
  ],
})

export function teamRenewals(model: LanguageModel): Promise<AskResult> {
  return ask('team plans renewing this quarter, biggest first', {
    model,
    schema,
    examples: ['plan is pro, sort by mrr desc'],
  })
}
