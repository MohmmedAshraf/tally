import type { LanguageModel } from 'ai'
import type { DataSource, Schema } from 'tally-core'
import { designColumn, withAiColumns, type AiSource } from 'tally-ai'

export async function addChurnRisk(
  base: DataSource,
  schema: Schema,
  model: LanguageModel,
): Promise<{ schema: Schema; source: AiSource }> {
  const { column, instruction } = await designColumn('Churn risk, low, medium or high', {
    model,
    schema,
  })
  const extended = schema.extend([column], 1)
  const source = withAiColumns(base, extended, [{ column: column.id, model, instruction }])
  return { schema: extended, source }
}
