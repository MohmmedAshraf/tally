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
    expect(Object.keys(request['$defs'] as object)).toContain('Filter')
    const keys = new Set<string>()
    for (const name of JSON_SCHEMA_NAMES) walk(toJsonSchema(name), (key) => keys.add(key))
    expect(keys.has('readOnly')).toBe(false)
  })

  it('matches the committed schema files', async () => {
    for (const name of JSON_SCHEMA_NAMES) {
      const committed = await readFile(new URL(`../schemas/${name}.json`, import.meta.url), 'utf8')
      expect(JSON.parse(committed), name).toEqual(toJsonSchema(name))
    }
  })
})
