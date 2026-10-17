import { accounts } from './accounts.ts'
import { deployments } from './deployments.ts'
import { ledger } from './ledger.ts'
import { roadmap } from './roadmap.ts'
import { stress } from './stress.ts'
import type { Dataset } from './dataset.ts'

export type { Dataset, SavedView } from './dataset.ts'

const workspaceDatasets: readonly Dataset[] = [accounts, ledger, roadmap]
const dataDatasets: readonly Dataset[] = [deployments]
export const datasets: readonly Dataset[] = [...workspaceDatasets, ...dataDatasets]

export function sectionOf(dataset: Dataset): string {
  return workspaceDatasets.includes(dataset) ? 'Workspace' : 'Data'
}

const developerDatasets: readonly Dataset[] = [stress]

export function datasetById(id: string | undefined): Dataset {
  return [...datasets, ...developerDatasets].find((dataset) => dataset.id === id) ?? accounts
}
