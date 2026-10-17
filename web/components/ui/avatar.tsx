import Image from 'next/image'
import type { ReactNode } from 'react'
import { photo, type PersonId } from '@/lib/accounts'

export function Avatar({
  person,
  size,
  className,
}: {
  readonly person: PersonId
  readonly size: number
  readonly className?: string
}): ReactNode {
  return (
    <Image
      src={photo(person)}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className ?? ''}`}
    />
  )
}
