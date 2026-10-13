import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { SqliteDatabase } from 'kysely'

function input(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  ) {
    return value
  }
  if (value === undefined) return null
  if (typeof value === 'boolean') return Number(value)
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}

export function nodeSqlite(database: DatabaseSync): SqliteDatabase {
  return {
    close: () => database.close(),
    prepare: (query) => {
      const statement = database.prepare(query)
      return {
        reader: statement.columns().length > 0,
        all: (parameters) => statement.all(...parameters.map(input)),
        run: (parameters) => statement.run(...parameters.map(input)),
        iterate: (parameters) => statement.iterate(...parameters.map(input)),
      }
    },
  }
}
