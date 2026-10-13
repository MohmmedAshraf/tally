import { TallyError } from '../errors.ts'
import type { ColumnType } from './column-type.ts'

export interface TypeRegistry {
  register<T>(type: ColumnType<T>): TypeRegistry
  get(name: string): ColumnType
  has(name: string): boolean
  names(): readonly string[]
  all(): readonly ColumnType[]
}

export function createTypeRegistry(types: readonly ColumnType[] = []): TypeRegistry {
  const byName = new Map<string, ColumnType>()
  const registry: TypeRegistry = {
    register(type) {
      if (byName.has(type.name)) {
        throw new TallyError('duplicate_type', `Column type "${type.name}" is already registered`)
      }
      byName.set(type.name, type)
      return registry
    },
    get(name) {
      const type = byName.get(name)
      if (type === undefined) {
        throw new TallyError('unknown_type', `Unknown column type "${name}"`)
      }
      return type
    },
    has(name) {
      return byName.has(name)
    },
    names() {
      return [...byName.keys()]
    },
    all() {
      return [...byName.values()]
    },
  }
  for (const type of types) registry.register(type)
  return registry
}
