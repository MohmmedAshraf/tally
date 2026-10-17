import { Popover } from '@base-ui/react/popover'
import { Switch } from '@base-ui/react/switch'
import { Download, SlidersHorizontal, Upload } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import {
  TallyError,
  columnLabel,
  createMutation,
  importRows,
  toCsv,
  type Density,
  type Grid,
  type RowData,
  type RowKey,
} from 'tally-core'
import { useView } from '../../hooks/use-store.ts'
import { useShell } from '../context.ts'
import { useLabels } from '../labels.ts'

const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious']

async function exportCsv(grid: Grid, name: string): Promise<void> {
  const rows = await grid.fetchAll()
  const columns = grid.layout().columns.map((entry) => entry.column)
  const text = toCsv(rows, grid.schema, { columns, header: 'label', format: grid.context.format })
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url))
}

function keyed(grid: Grid, rows: readonly RowData[]): readonly RowData[] {
  const { schema } = grid
  const field = schema.keyField
  const taken = new Set<RowKey>(grid.rows.rows().map((row) => schema.keyOf(row)))
  return rows.map((row) => {
    if (field === undefined) return { ...grid.newRow(), ...row }
    const { [field]: own, ...values } = row
    if ((typeof own === 'string' || typeof own === 'number') && own !== '' && !taken.has(own)) {
      taken.add(own)
      return row
    }
    return { ...grid.newRow(), ...values }
  })
}

async function importCsv(grid: Grid, file: File, label: (count: number) => string): Promise<void> {
  const { rows, issues } = importRows(await file.text(), grid.schema)
  const issue = issues[0]
  if (issue !== undefined) throw new TallyError('invalid_value', issue.message)
  if (rows.length === 0) return
  const result = await grid.commit(
    createMutation({
      label: label(rows.length),
      inserted: keyed(grid, rows).map((row) => ({ row })),
    }),
  )
  const error = result.errors?.[0]
  if (error !== undefined) throw new TallyError('invalid_value', error.message)
}

export function DisplayMenu({ grid }: { readonly grid: Grid }): ReactNode {
  const labels = useLabels()
  const { root, label: name, fail } = useShell()
  const input = useRef<HTMLInputElement>(null)
  const run = (task: Promise<void>): void => {
    fail(undefined)
    task.catch(fail)
  }
  const density = useView(grid, (view) => view.density)
  const columns = useView(grid, (view) => view.columns)
  return (
    <Popover.Root>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file !== undefined) run(importCsv(grid, file, labels.importRows))
        }}
      />
      <Popover.Trigger className="tally-button" data-outline="" aria-label={labels.display}>
        <SlidersHorizontal size={14} aria-hidden />
        <span>{labels.display}</span>
      </Popover.Trigger>
      <Popover.Portal container={root}>
        <Popover.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          sideOffset={6}
          align="end"
        >
          <Popover.Popup className="tally-popup tally-display" aria-label={labels.display}>
            <div className="tally-menu-label">{labels.density}</div>
            <div className="tally-segmented" role="radiogroup" data-fill="">
              {DENSITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={density === option}
                  className="tally-segment"
                  onClick={() => grid.view.setDensity(option)}
                >
                  {labels.densities[option]}
                </button>
              ))}
            </div>
            <div className="tally-menu-label">{labels.columns}</div>
            <div className="tally-display-columns">
              {columns.map((state) => {
                const column = grid.schema.column(state.id)
                if (column === undefined) return null
                const label = columnLabel(column)
                const pinned = state.pin === 'left'
                return (
                  <div key={state.id} className="tally-display-row">
                    <Switch.Root
                      className="tally-switch"
                      checked={state.hidden !== true}
                      aria-label={label}
                      onCheckedChange={(checked) => grid.view.setColumnHidden(state.id, !checked)}
                    >
                      <Switch.Thumb className="tally-switch-thumb" />
                    </Switch.Root>
                    <span className="tally-text">{label}</span>
                    <button
                      type="button"
                      className="tally-display-pin"
                      aria-pressed={pinned}
                      aria-label={`${pinned ? labels.unpin : labels.pinLeft}: ${label}`}
                      onClick={() => grid.view.pinColumn(state.id, pinned ? undefined : 'left')}
                    >
                      {pinned ? labels.pinned : labels.pin}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="tally-menu-separator" />
            <Popover.Close
              className="tally-popup-item tally-display-action"
              onClick={() => run(exportCsv(grid, labels.exportFileName(name)))}
            >
              <Download size={15} strokeWidth={1.7} aria-hidden />
              {labels.exportCsv}
            </Popover.Close>
            {grid.capabilities.mutate ? (
              <Popover.Close
                className="tally-popup-item tally-display-action"
                onClick={() => input.current?.click()}
              >
                <Upload size={15} strokeWidth={1.7} aria-hidden />
                {labels.importCsv}
              </Popover.Close>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
