import type { ReactNode } from 'react'
import {
  siLaravel,
  siPostgresql,
  siReact,
  siSolid,
  siSqlite,
  siSupabase,
  siSvelte,
  siVuedotjs,
  type SimpleIcon,
} from 'simple-icons'

const brands = {
  react: siReact,
  vue: siVuedotjs,
  svelte: siSvelte,
  solid: siSolid,
  postgres: siPostgresql,
  sqlite: siSqlite,
  laravel: siLaravel,
  supabase: siSupabase,
} satisfies Record<string, SimpleIcon>

export type Brand = keyof typeof brands

export function BrandIcon({
  brand,
  size,
}: {
  readonly brand: Brand
  readonly size: number
}): ReactNode {
  const icon = brands[brand]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={`#${icon.hex}`} aria-hidden>
      <path d={icon.path} />
    </svg>
  )
}
