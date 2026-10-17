import { createArraySource, createGrid, createSchema, type DataSource } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account', editable: false },
    { id: 'mrr', label: 'MRR', type: 'currency' },
  ],
})

const rows = createArraySource([{ id: 1, account: 'Acme', mrr: 4200 }], schema)

const source: DataSource = {
  ...rows,
  mutate: async (mutations) => {
    const negative = mutations
      .flatMap((mutation) => mutation.changes)
      .find((change) => change.column === 'mrr' && typeof change.to === 'number' && change.to < 0)
    if (negative !== undefined) {
      return {
        accepted: false,
        errors: [{ key: negative.key, column: 'mrr', message: 'MRR cannot be negative' }],
      }
    }
    return (await rows.mutate?.(mutations)) ?? { accepted: true }
  },
}

const grid = createGrid({ schema, source })
await grid.load()

const result = await grid.setCells([{ key: 1, column: 'mrr', value: '-500' }])

export const message = result.accepted ? undefined : result.errors?.[0]?.message
