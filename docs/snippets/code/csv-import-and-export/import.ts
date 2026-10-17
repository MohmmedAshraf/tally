import { importRows, type Grid, type MutationResult } from 'tally-core'

export async function importFile(grid: Grid, file: File): Promise<MutationResult> {
  const { rows, issues } = importRows(await file.text(), grid.schema)
  const issue = issues[0]
  if (issue !== undefined) throw new Error(`Row ${issue.row + 1}: ${issue.message}`)
  return grid.insertRows(rows.map((row) => ({ ...grid.newRow(), ...row })))
}
