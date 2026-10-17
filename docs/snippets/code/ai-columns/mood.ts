import type { LanguageModel } from 'ai'
import { createArraySource, createSchema, type RowData } from 'tally-core'
import { withAiColumns, type AiSource } from 'tally-ai'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account' },
    { id: 'notes' },
    {
      id: 'mood',
      type: 'enum',
      options: [{ value: 'happy' }, { value: 'neutral' }, { value: 'unhappy' }],
      ai: true,
      filterable: false,
      sortable: false,
      groupable: false,
    },
  ],
})

export function moodSource(rows: readonly RowData[], model: LanguageModel): AiSource {
  return withAiColumns(createArraySource(rows, schema), schema, [
    {
      column: 'mood',
      model,
      instruction: 'Judge the customer mood from the notes.',
      inputs: ['notes'],
      batchSize: 20,
      concurrency: 2,
    },
  ])
}
