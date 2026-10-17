import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'
import { createSchema, type RowData } from 'tally-core'
import { createCollectionSource } from 'tally-adapters/db'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'mrr', type: 'currency' }],
})

const rows: RowData[] = [{ id: 'acc_1', account: 'Acme', mrr: 4200 }]

const accounts = createCollection(
  localOnlyCollectionOptions({ getKey: (row: RowData) => String(row['id']), initialData: rows }),
)

export const source = createCollectionSource(accounts, schema, {
  item: (row) => ({ ...row, id: crypto.randomUUID() }),
})
