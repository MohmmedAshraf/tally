import { accounts } from './accounts.ts'
import { deployments } from './deployments.ts'
import { ledger } from './ledger.ts'
import { roadmap } from './roadmap.ts'
import type { Dataset } from './dataset.ts'

export type { Dataset, SavedView } from './dataset.ts'

export const workspaceDatasets: readonly Dataset[] = [accounts, ledger, roadmap]
export const dataDatasets: readonly Dataset[] = [deployments]
export const datasets: readonly Dataset[] = [...workspaceDatasets, ...dataDatasets]

export function datasetById(id: string | undefined): Dataset {
  return datasets.find((dataset) => dataset.id === id) ?? accounts
}
