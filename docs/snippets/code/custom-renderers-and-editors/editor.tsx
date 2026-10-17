import { useRef, useState, type ReactNode } from 'react'
import { columnLabel } from 'tally-core'
import { type CellEditorProps, type CellEditors } from 'tally-react'

function ScoreEditor({ value, column, commit, cancel }: CellEditorProps): ReactNode {
  const [score, setScore] = useState(typeof value === 'number' ? value : 0)
  const settled = useRef(false)
  const settle = (finish: () => void): void => {
    if (settled.current) return
    settled.current = true
    finish()
  }
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={score}
      autoFocus
      aria-label={columnLabel(column)}
      onChange={(event) => setScore(Number(event.target.value))}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          settle(cancel)
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          settle(() => commit(score, event.key === 'Tab' ? 'right' : 'down'))
        }
      }}
      onBlur={() => settle(() => commit(score))}
    />
  )
}

export const editors: CellEditors = { bar: ScoreEditor }
