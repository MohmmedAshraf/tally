import { DatabaseSync } from 'node:sqlite'
import { Kysely, SqliteDialect, sql } from 'kysely'
import { createSchema, type RowData, type ValueKind } from 'tally-core'
import {
  createKyselyAdapter,
  createTallyHandler,
  nodeSqlite,
  sqliteDialect,
  type SqlDatabase,
  type TallyHandler,
} from 'tally-server'
import { columns, makeRows } from '../src/data.ts'

const TABLE = 'accounts'
const ROWS = 5000
const CHUNK = 500

const SQL_TYPES: Readonly<Record<ValueKind, string>> = {
  text: 'text',
  enum: 'text',
  number: 'real',
  date: 'text',
  boolean: 'integer',
}

function chunks<T>(list: readonly T[], size: number): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, index) =>
    list.slice(index * size, (index + 1) * size),
  )
}

export async function createPlaygroundHandler(): Promise<TallyHandler> {
  const schema = createSchema({ columns, key: 'id' })
  const db = new Kysely<SqlDatabase>({
    dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
  })
  const ddl = [
    'id integer primary key',
    ...schema.columns.map((column) => `${column.id} ${SQL_TYPES[schema.typeOf(column).kind]}`),
  ].join(', ')
  await sql.raw(`create table ${TABLE} (${ddl})`).execute(db)
  const encode = (row: RowData): Record<string, unknown> => {
    const entries: readonly (readonly [string, unknown])[] = schema.columns.map((column) => [
      column.id,
      sqliteDialect.encode(schema.typeOf(column).kind, row[column.id]),
    ])
    return Object.fromEntries([['id', row['id']], ...entries])
  }
  await Promise.all(
    chunks(makeRows(ROWS).map(encode), CHUNK).map((chunk) =>
      db.insertInto(TABLE).values(chunk).execute(),
    ),
  )
  const source = createKyselyAdapter({
    db,
    table: TABLE,
    schema,
    dialect: sqliteDialect,
    mutable: true,
  })
  return createTallyHandler({ source, schema })
}
