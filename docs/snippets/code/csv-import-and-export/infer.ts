import { createArraySource, createSchema } from 'tally-core'
import { importCsv } from 'tally-core/import'

const text = 'Account,Plan,MRR,Renewal\nAcme,pro,4200,2026-11-02\nGlobex,team,9800,2027-01-15'

const { columns, rows, keyField } = importCsv(text)

export const schema = createSchema({
  key: keyField,
  columns: columns.map((entry) => entry.column),
})

export const source = createArraySource(rows, schema)
