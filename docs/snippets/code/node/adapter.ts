import { DatabaseSync } from 'node:sqlite'
import { Kysely, SqliteDialect, sql } from 'kysely'
import { createSchema } from 'tally-core'
import { createKyselyAdapter, nodeSqlite, sqliteDialect, type SqlDatabase } from 'tally-server'

const db = new Kysely<SqlDatabase>({
  dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync('app.db')) }),
})

export const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
    { id: 'renewal', type: 'date' },
  ],
})

export const accounts = createKyselyAdapter({
  db,
  table: 'accounts',
  schema,
  dialect: sqliteDialect,
  columns: { renewal: 'renews_on' },
  flags: { paying: sql`${sql.ref('mrr')} > 0` },
  pagination: 'cursor',
})
