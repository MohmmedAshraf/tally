import { mkdir, writeFile } from 'node:fs/promises'
import { createArraySource, type QueryResponse } from 'tally-core'
import { conformanceCases, conformancePageCases, type ConformanceCase } from '../src/conformance.ts'
import { CONFORMANCE_TODAY, conformanceRows, conformanceSchema } from '../src/fixtures.ts'
import { JSON_SCHEMA_NAMES, toJsonSchema } from '../src/json-schema.ts'

const php = new URL('../../php/', import.meta.url)
const schemas = new URL('resources/schemas/', php)
const fixtures = new URL('tests/Fixtures/', php)

const reference = createArraySource(conformanceRows, conformanceSchema, {
  today: CONFORMANCE_TODAY,
  pagination: 'offset',
})

function keyed(response: QueryResponse) {
  return { ...response, rows: response.rows.map((row) => conformanceSchema.keyOf(row)) }
}

function expected(entries: readonly ConformanceCase[]) {
  return Promise.all(
    entries.map(async (entry) => ({
      name: entry.name,
      requires: entry.requires ?? [],
      request: entry.request,
      expected: keyed(await reference.query(entry.request)),
    })),
  )
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

const conformance = {
  today: CONFORMANCE_TODAY,
  key: conformanceSchema.keyField,
  columns: conformanceSchema.columns,
  rows: conformanceRows,
  cases: await expected(conformanceCases),
  pages: await expected(conformancePageCases),
}

await Promise.all([mkdir(schemas, { recursive: true }), mkdir(fixtures, { recursive: true })])
await Promise.all([
  ...JSON_SCHEMA_NAMES.map((name) =>
    writeFile(new URL(`${name}.json`, schemas), json(toJsonSchema(name))),
  ),
  writeFile(new URL('conformance.json', fixtures), json(conformance)),
])
