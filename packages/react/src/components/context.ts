import { createContext, useContext, type Context, type RefObject } from 'react'
import type { CellRenderers } from './cells/renderers.tsx'

export interface TallyShell {
  readonly viewport: RefObject<HTMLDivElement | null>
  readonly renderers: CellRenderers
}

export const ShellContext: Context<TallyShell | undefined> = createContext<TallyShell | undefined>(
  undefined,
)

export function useShell(): TallyShell {
  const shell = useContext(ShellContext)
  if (shell === undefined) throw new Error('Tally components must be rendered inside <Tally>')
  return shell
}
