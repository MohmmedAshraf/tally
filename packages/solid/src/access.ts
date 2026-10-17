import type { Accessor } from 'solid-js'

export type MaybeAccessor<T> = T | Accessor<T>

export function access<T extends object>(value: MaybeAccessor<T>): T {
  return typeof value === 'function' ? value() : value
}
