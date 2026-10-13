import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { JSON_SCHEMA_NAMES, toJsonSchema } from './json-schema.ts'

function walk(value: unknown, visit: (key: string) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit)
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      visit(key)
      walk(entry, visit)
    }
  }
}

describe('toJsonSchema', () => {
  it('names shared definitions and never marks fields read only', () => {
    const request = toJsonSchema('query-request')
    expect(request['$schema']).toBe('https://json-schema.org/draft/2020-12/schema')
    const defs = request['$defs']
    expect(typeof defs === 'object' && defs !== null ? Object.keys(defs) : []).toContain('Filter')
    const keys = new Set<string>()
    for (const name of JSON_SCHEMA_NAMES) walk(toJsonSchema(name), (key) => keys.add(key))
    expect(keys.has('readOnly')).toBe(false)
  })

  it('matches the committed schema files', async () => {
    const committed = await Promise.all(
      JSON_SCHEMA_NAMES.map(async (name) => {
        const text = await readFile(new URL(`../schemas/${name}.json`, import.meta.url), 'utf8')
        return [name, JSON.parse(text) as unknown] as const
      }),
    )
    for (const [name, document] of committed) expect(document).toEqual(toJsonSchema(name))
  })
})
