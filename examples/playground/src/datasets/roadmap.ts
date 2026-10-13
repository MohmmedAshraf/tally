import { ListTodo } from 'lucide-react'
import { createSchema, type Column, type RowData } from 'tally-core'
import { addDays, pick, random, TEAM, TODAY } from './shared.ts'
import type { Dataset } from './dataset.ts'

const EPICS = [
  'Column virtualization',
  'Query language v2',
  'Accessibility audit',
  'Theming API',
  'Server-side data source',
  'Clipboard & paste',
  'Mobile layout',
  'Docs site',
  'Plugin system',
  'Performance budget',
]
const VERBS = [
  'Design',
  'Implement',
  'Test',
  'Document',
  'Benchmark',
  'Refactor',
  'Prototype',
  'Review',
]
const OBJECTS = [
  'row renderer',
  'keyboard model',
  'filter parser',
  'header menu',
  'resize handle',
  'focus ring',
  'sticky columns',
  'type detector',
  'scroll anchoring',
  'ARIA grid roles',
  'token export',
  'dark palette',
  'undo stack',
  'paste handler',
  'fetch adapter',
  'cursor pagination',
  'touch gestures',
  'card layout',
  'API reference',
  'live examples',
]
const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const PROGRESS: Readonly<Record<string, number>> = {
  done: 100,
  in_review: 80,
  in_progress: 40,
}

const roadmapColumns: readonly Column[] = [
  { id: 'title', label: 'Title', type: 'text', width: 340, pin: 'left', tree: true, card: 'title' },
  { id: 'key', label: 'Key', type: 'id', width: 100, card: 'meta' },
  {
    id: 'status',
    label: 'Status',
    type: 'enum',
    width: 130,
    options: [
      { value: 'backlog', label: 'Backlog', color: 'oklch(0.62 0.01 80)' },
      { value: 'todo', label: 'Todo', color: 'oklch(0.7 0.03 80)' },
      { value: 'in_progress', label: 'In progress', color: 'oklch(0.66 0.15 250)' },
      { value: 'in_review', label: 'In review', color: 'oklch(0.66 0.15 300)' },
      { value: 'done', label: 'Done', color: 'oklch(0.62 0.14 150)' },
    ],
    aggregate: 'count',
    card: 'badge',
  },
  {
    id: 'priority',
    label: 'Priority',
    type: 'enum',
    width: 116,
    options: [
      { value: 'urgent', label: 'Urgent', color: 'oklch(0.6 0.19 28)' },
      { value: 'high', label: 'High', color: 'oklch(0.7 0.16 55)' },
      { value: 'medium', label: 'Medium', color: 'oklch(0.7 0.1 90)' },
      { value: 'low', label: 'Low', color: 'oklch(0.66 0.02 80)' },
    ],
    card: 'badge',
  },
  { id: 'assignee', label: 'Assignee', type: 'person', width: 160, card: 'meta' },
  {
    id: 'estimate',
    label: 'Estimate',
    type: 'int',
    width: 110,
    format: { suffix: ' pt' },
    aggregate: 'sum',
    rollup: true,
    card: 'metric',
  },
  { id: 'progress', label: 'Progress', type: 'bar', width: 140, aggregate: 'avg', rollup: true },
  { id: 'due', label: 'Due', type: 'date', width: 136, relative: true, card: 'meta' },
]

interface Issue extends RowData {
  readonly id: number
  readonly parent: number | null
  estimate: number
  progress: number
  readonly status: string
}

function rollup(rows: readonly Issue[]): void {
  const children = new Map<number, Issue[]>()
  for (const row of rows) {
    if (row.parent === null) continue
    const list = children.get(row.parent) ?? []
    list.push(row)
    children.set(row.parent, list)
  }
  const visit = (row: Issue): readonly [number, number] => {
    const kids = children.get(row.id)
    if (kids === undefined) {
      row.progress = PROGRESS[row.status] ?? 0
      return [row.estimate, (row.estimate * row.progress) / 100]
    }
    let estimate = 0
    let done = 0
    for (const kid of kids) {
      const [total, finished] = visit(kid)
      estimate += total
      done += finished
    }
    row.estimate = estimate
    row.progress = estimate === 0 ? 0 : Math.round((done / estimate) * 100)
    return [estimate, done]
  }
  for (const row of rows) if (row.parent === null) visit(row)
}

function makeRoadmap(): RowData[] {
  const next = random(42)
  const rows: Issue[] = []
  let id = 101
  EPICS.forEach((title, index) => {
    const epic = id
    rows.push({
      id: id++,
      parent: null,
      title,
      key: `TAL-${epic}`,
      status: pick(next, ['todo', 'in_progress', 'in_progress', 'in_review']),
      priority: pick(next, PRIORITIES),
      assignee: TEAM[index % TEAM.length]!,
      estimate: 0,
      progress: 0,
      due: addDays(TODAY, 12 + index * 13),
    })
    const stories = 3 + Math.floor(next() * 4)
    for (let story = 0; story < stories; story += 1) {
      const storyId = id
      const due = addDays(TODAY, Math.floor(next() * 90) - 10)
      const tasks = Math.floor(next() * 4)
      rows.push({
        id: id++,
        parent: epic,
        title: `${pick(next, VERBS)} ${pick(next, OBJECTS)}`,
        key: `TAL-${storyId}`,
        status: pick(next, STATUSES),
        priority: pick(next, PRIORITIES),
        assignee: pick(next, TEAM),
        estimate: tasks === 0 ? 1 + Math.floor(next() * 8) : 0,
        progress: 0,
        due,
      })
      for (let task = 0; task < tasks; task += 1) {
        rows.push({
          id: id,
          parent: storyId,
          title: `${pick(next, VERBS)} ${pick(next, OBJECTS)}`,
          key: `TAL-${id}`,
          status: pick(next, STATUSES),
          priority: pick(next, PRIORITIES),
          assignee: pick(next, TEAM),
          estimate: 1 + Math.floor(next() * 5),
          progress: 0,
          due,
        })
        id += 1
      }
    }
  })
  rollup(rows)
  return rows
}

export const roadmap: Dataset = {
  id: 'roadmap',
  title: 'Roadmap',
  unit: 'issues',
  icon: ListTodo,
  schema: createSchema({ columns: roadmapColumns, key: 'id', parent: 'parent' }),
  rows: makeRoadmap(),
  views: [
    { name: 'Roadmap', query: '' },
    { name: 'Open work', query: 'status is not done' },
    { name: 'By assignee', query: 'sort by priority asc, group by assignee' },
  ],
  examples: [
    'assignee is ada',
    'status is in progress or in review',
    'priority is urgent',
    'due next 30 days',
  ],
  remote: false,
}
