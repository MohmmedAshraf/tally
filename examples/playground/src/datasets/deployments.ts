import { Rocket } from 'lucide-react'
import { createSchema, type Column, type RowData } from 'tally-core'
import { addDays, pick, random, weighted, TEAM, TODAY } from './shared.ts'
import type { Dataset } from './dataset.ts'

const SERVICES = [
  'api-gateway',
  'billing-worker',
  'web',
  'search-indexer',
  'auth',
  'notifications',
  'grid-docs',
  'ingest',
]

const deploymentColumns: readonly Column[] = [
  { id: 'service', label: 'Service', type: 'text', width: 180, card: 'title' },
  {
    id: 'env',
    label: 'Env',
    type: 'enum',
    width: 130,
    options: [
      { value: 'production', label: 'Production' },
      { value: 'staging', label: 'Staging' },
      { value: 'preview', label: 'Preview' },
    ],
    card: 'badge',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'enum',
    width: 130,
    options: [
      { value: 'succeeded', label: 'Succeeded', color: 'oklch(0.62 0.14 150)' },
      { value: 'failed', label: 'Failed', color: 'oklch(0.6 0.19 28)' },
      { value: 'building', label: 'Building', color: 'oklch(0.66 0.15 250)' },
      { value: 'canceled', label: 'Canceled', color: 'oklch(0.62 0.01 80)' },
    ],
    aggregate: 'count',
    card: 'badge',
  },
  {
    id: 'duration',
    label: 'Duration',
    type: 'duration',
    width: 110,
    format: { durationUnit: 'seconds' },
    aggregate: 'avg',
    card: 'metric',
  },
  { id: 'sha', label: 'Commit', type: 'id', width: 110, card: 'meta' },
  { id: 'author', label: 'Author', type: 'person', width: 160, card: 'meta' },
  { id: 'deployed', label: 'Deployed', type: 'date', width: 130, relative: true, card: 'meta' },
]

function makeDeployments(): RowData[] {
  const next = random(5)
  return Array.from({ length: 18 }, (_, index) => ({
    id: index + 1,
    service: pick(next, SERVICES),
    env: weighted(next, [
      ['production', 4],
      ['staging', 3],
      ['preview', 5],
    ] as const),
    status: weighted(next, [
      ['succeeded', 12],
      ['failed', 2],
      ['building', 1],
      ['canceled', 1],
    ] as const),
    duration: 40 + Math.floor(next() * 400),
    sha: Math.floor(next() * 0xfffffff)
      .toString(16)
      .padStart(7, '0'),
    author: pick(next, TEAM),
    deployed: addDays(TODAY, -Math.floor(index / 3)),
  }))
}

export const deployments: Dataset = {
  id: 'deployments',
  title: 'Deployments',
  unit: 'deployments',
  icon: Rocket,
  schema: createSchema({ columns: deploymentColumns, key: 'id' }),
  rows: makeDeployments(),
  views: [{ name: 'All deployments', query: 'sort by deployed desc' }],
  examples: ['status is failed', 'env is production'],
  remote: true,
  simulate: true,
}
