import { DatabaseSync } from 'node:sqlite'
import { Kysely, SqliteDialect, sql } from 'kysely'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { createKyselyAdapter, nodeSqlite, sqliteDialect, type SqlDatabase } from 'tally-server'

const db = new Kysely<SqlDatabase>({
  dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
})

await sql
  .raw(
    `create table accounts (
      id text primary key, account text, owner text, plan text, mrr real, seats integer,
      score real, growth real, health integer, renewal text, active integer, email text,
      website text, tenure integer)`,
  )
  .execute(db)

const rows = conformanceRows.map((row) =>
  Object.fromEntries(
    conformanceSchema.columns.map((column) => [
      column.id,
      sqliteDialect.encode(conformanceSchema.typeOf(column).kind, row[column.id]),
    ]),
  ),
)
await db.insertInto('accounts').values(rows).execute()

const adapter = createKyselyAdapter({
  db,
  table: 'accounts',
  schema: conformanceSchema,
  dialect: sqliteDialect,
  today: CONFORMANCE_TODAY,
})

export const report = await runConformance((request) => adapter.query(request), {
  capabilities: adapter.capabilities,
})
