import { DatabaseSync } from 'node:sqlite'
import { Kysely, SqliteDialect, sql } from 'kysely'
import type { RowData, Schema, ValueKind } from 'tally-core'
import {
  createKyselyAdapter,
  createTallyHandler,
  nodeSqlite,
  sqliteDialect,
  type SqlDatabase,
  type TallyHandler,
} from 'tally-server'
import { datasets } from '../src/datasets/index.ts'

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

async function createTableHandler(
  db: Kysely<SqlDatabase>,
  table: string,
  schema: Schema,
  rows: readonly RowData[],
): Promise<TallyHandler> {
  const ddl = [
    'id integer primary key',
    ...schema.columns.map((column) => `${column.id} ${SQL_TYPES[schema.typeOf(column).kind]}`),
  ].join(', ')
  await sql.raw(`create table ${table} (${ddl})`).execute(db)
  const encode = (row: RowData): Record<string, unknown> => {
    const entries: readonly (readonly [string, unknown])[] = schema.columns.map((column) => [
      column.id,
      sqliteDialect.encode(schema.typeOf(column).kind, row[column.id]),
    ])
    return Object.fromEntries([['id', row['id']], ...entries])
  }
  await Promise.all(
    chunks(rows.map(encode), CHUNK).map((chunk) => db.insertInto(table).values(chunk).execute()),
  )
  const source = createKyselyAdapter({ db, table, schema, dialect: sqliteDialect, mutable: true })
  return createTallyHandler({ source, schema, basePath: `/${table}` })
}

export async function createPlaygroundHandler(): Promise<TallyHandler> {
  const db = new Kysely<SqlDatabase>({
    dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
  })
  const handlers = new Map(
    await Promise.all(
      datasets
        .filter((dataset) => dataset.remote)
        .map(async (dataset) => {
          const handler = await createTableHandler(db, dataset.id, dataset.schema, dataset.rows)
          return [dataset.id, handler] as const
        }),
    ),
  )
  return (request) => {
    const [, id = ''] = new URL(request.url).pathname.split('/')
    const handler = handlers.get(id)
    return handler === undefined
      ? Promise.resolve(new Response(null, { status: 404 }))
      : handler(request)
  }
}
