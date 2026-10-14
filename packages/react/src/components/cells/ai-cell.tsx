import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animateDecode } from '../motion.ts'

const STAGGER_MS = 30
const STAGGER_ROWS = 24

export interface AiCellProps {
  readonly pending: boolean
  readonly text: string
  readonly index: number
  readonly children: ReactNode
}

export function AiCell({ pending, text, index, children }: AiCellProps): ReactNode {
  const wasPending = useRef(pending)
  const [decoding, setDecoding] = useState<string | undefined>(undefined)
  useEffect(() => {
    const arrived = wasPending.current && !pending
    wasPending.current = pending
    if (!arrived || text === '') return
    let stop = (): void => undefined
    const timer = setTimeout(
      () => {
        stop = animateDecode('', text, setDecoding, () => setDecoding(undefined))
      },
      Math.min(index, STAGGER_ROWS) * STAGGER_MS,
    )
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [pending, text, index])
  if (pending) return <span className="tally-skeleton" data-ai="" aria-hidden />
  if (decoding !== undefined) {
    return (
      <span className="tally-text tally-decode" data-ai="">
        {decoding}
      </span>
    )
  }
  return children
}
