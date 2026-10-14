import { Popover } from '@base-ui/react/popover'
import { CircleAlert, Sparkles } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { Grid } from 'tally-core'
import { useShell } from '../context.ts'
import { useLabels } from '../labels.ts'

export type AddColumnHandler = (prompt: string, grid: Grid) => Promise<string>

export interface AiMenuProps {
  readonly grid: Grid
  readonly addColumn: AddColumnHandler
  readonly suggestions: readonly string[]
}

export function AiMenu({ grid, addColumn, suggestions }: AiMenuProps): ReactNode {
  const labels = useLabels()
  const { root, enterColumn } = useShell()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const text = prompt.trim()
    if (text === '' || busy) return
    setBusy(true)
    setError(undefined)
    try {
      const id = await addColumn(text, grid)
      enterColumn(id)
      setPrompt('')
      setOpen(false)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="tally-button" data-ai="" aria-label={labels.addAiColumn}>
        <Sparkles size={14} aria-hidden />
        <span>{labels.ai}</span>
      </Popover.Trigger>
      <Popover.Portal container={root}>
        <Popover.Positioner
          className="tally-popup-positioner"
          positionMethod="fixed"
          sideOffset={6}
          align="end"
        >
          <Popover.Popup className="tally-popup tally-ai-menu" aria-label={labels.addAiColumn}>
            <div className="tally-ai-title">
              <Sparkles size={15} aria-hidden />
              {labels.addAiColumn}
            </div>
            <form className="tally-ai-form" onSubmit={(event) => void submit(event)}>
              <input
                autoFocus
                className="tally-ai-input"
                value={prompt}
                placeholder={labels.aiColumnPlaceholder}
                aria-label={labels.addAiColumn}
                disabled={busy}
                onChange={(event) => {
                  setPrompt(event.target.value)
                  setError(undefined)
                }}
              />
              <button
                type="submit"
                className="tally-button"
                data-primary=""
                disabled={busy || prompt.trim() === ''}
                {...(busy ? { 'data-busy': '' } : {})}
              >
                {labels.add}
              </button>
            </form>
            {error === undefined ? null : (
              <div className="tally-ai-error" role="alert">
                <CircleAlert size={14} aria-hidden />
                {error}
              </div>
            )}
            {suggestions.length === 0 ? null : (
              <div className="tally-ai-suggestions" {...(prompt === '' ? {} : { 'data-dim': '' })}>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="tally-ai-suggestion"
                    onClick={() => setPrompt(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
