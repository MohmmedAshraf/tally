import type { LanguageModel } from 'ai'
import { useMemo, useState, type ReactNode } from 'react'
import type { Column, DataSource, Schema } from 'tally-core'
import { designColumn, withAiColumns } from 'tally-ai'
import { Tally, useGrid, type TallyAi } from 'tally-react'

interface Added {
  readonly column: Column
  readonly instruction: string
}

export function Accounts({
  schema: base,
  source: rows,
  model,
}: {
  schema: Schema
  source: DataSource
  model: LanguageModel
}): ReactNode {
  const [added, setAdded] = useState<readonly Added[]>([])
  const [cache] = useState(() => new Map<string, unknown>())
  const schema = useMemo(() => base.extend(added.map((entry) => entry.column)), [base, added])
  const source = useMemo(
    () =>
      added.length === 0
        ? rows
        : withAiColumns(
            rows,
            schema,
            added.map(({ column, instruction }) => ({
              column: column.id,
              model,
              instruction,
              cache,
            })),
          ),
    [rows, schema, added, model, cache],
  )
  const ai = useMemo<TallyAi>(
    () => ({
      addColumn: async (prompt, grid) => {
        const design = await designColumn(prompt, { model, schema: grid.schema })
        setAdded((list) => [...list, design])
        return design.column.id
      },
      suggestions: ['Churn risk, low, medium or high'],
    }),
    [model],
  )
  const grid = useGrid({ schema, source })
  return <Tally grid={grid} label="Accounts" ai={ai} />
}
