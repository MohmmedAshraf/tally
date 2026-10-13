import type { EnumOption } from '../schema/column.ts'
import type { ColumnType } from '../types/column-type.ts'
import type { TypeRegistry } from '../types/registry.ts'

export interface Detection {
  readonly type: string
  readonly confidence: number
  readonly options?: readonly EnumOption[] | undefined
}

export interface DetectOptions {
  readonly threshold?: number | undefined
  readonly maxEnumOptions?: number | undefined
  readonly priority?: readonly string[] | undefined
}

export const defaultDetectionPriority: readonly string[] = [
  'bool',
  'email',
  'url',
  'date',
  'percent',
  'currency',
  'int',
  'number',
]

function candidates(registry: TypeRegistry, priority: readonly string[]): readonly ColumnType[] {
  const ordered = priority.filter((name) => registry.has(name)).map((name) => registry.get(name))
  const rest = registry
    .all()
    .filter((type) => type.detect !== undefined && !priority.includes(type.name))
  return [...ordered, ...rest].filter((type) => type.detect !== undefined)
}

export function detectColumnType(
  samples: readonly string[],
  registry: TypeRegistry,
  options: DetectOptions = {},
): Detection {
  const threshold = options.threshold ?? 0.75
  const values = samples.map((sample) => sample.trim()).filter((sample) => sample !== '')
  if (values.length === 0) return { type: 'text', confidence: 0 }
  for (const type of candidates(registry, options.priority ?? defaultDetectionPriority)) {
    if (type.detect === undefined) continue
    const matches = values.filter((value) => type.detect?.(value) === true).length
    const confidence = matches / values.length
    if (confidence >= threshold) return { type: type.name, confidence }
  }
  const distinct = [...new Set(values)]
  const maxEnumOptions =
    options.maxEnumOptions ?? Math.max(3, Math.min(12, Math.round(values.length * 0.4)))
  if (
    distinct.length <= maxEnumOptions &&
    values.length >= distinct.length * 2 &&
    registry.has('enum')
  ) {
    return {
      type: 'enum',
      confidence: 1,
      options: distinct.map((value) => ({ value })),
    }
  }
  return { type: 'text', confidence: 1 }
}
