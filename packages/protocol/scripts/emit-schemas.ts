import { mkdir, writeFile } from 'node:fs/promises'
import { JSON_SCHEMA_NAMES, toJsonSchema } from '../src/json-schema.ts'

const out = new URL('../schemas/', import.meta.url)
await mkdir(out, { recursive: true })
await Promise.all(
  JSON_SCHEMA_NAMES.map((name) =>
    writeFile(new URL(`${name}.json`, out), `${JSON.stringify(toJsonSchema(name), null, 2)}\n`),
  ),
)
