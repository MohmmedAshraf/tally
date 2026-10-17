import { toCsv, type Grid } from 'tally-core'

export async function exportCsv(grid: Grid): Promise<string> {
  const rows = await grid.fetchAll()
  const columns = grid.layout().columns.map((entry) => entry.column)
  return toCsv(rows, grid.schema, { columns, header: 'label', format: grid.context.format })
}
