import type { ReactNode } from 'react'
import { isEmptyValue } from 'tally-core'
import { defaultRenderers, type CellRenderer } from 'tally-react'
import { PEOPLE, photoOf, type PersonId } from '@/datasets/shared'
import { cn } from 'cn'

export function Photo({
  id,
  className,
}: {
  readonly id: PersonId
  readonly className?: string | undefined
}): ReactNode {
  return (
    <img
      src={`/people/${id}.webp`}
      alt={PEOPLE[id]}
      className={cn('size-8 shrink-0 rounded-full object-cover', className)}
    />
  )
}

export const PhotoPerson: CellRenderer = (props) => {
  const { value, text } = props
  const src = isEmptyValue(value) ? undefined : photoOf(text)
  if (src === undefined) return defaultRenderers['person']?.(props)
  return (
    <>
      <img src={src} alt="" className="tally-avatar object-cover" />
      <span className="tally-text">{text}</span>
    </>
  )
}
