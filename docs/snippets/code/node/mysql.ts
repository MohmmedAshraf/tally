import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import { createKyselyAdapter, mysqlDialect, type SqlDatabase } from 'tally-server'
import { schema } from './adapter.ts'

const db = new Kysely<SqlDatabase>({
  dialect: new MysqlDialect({ pool: createPool({ uri: process.env['DATABASE_URL'] ?? '' }) }),
})

export const accounts = createKyselyAdapter({
  db,
  table: 'accounts',
  schema,
  dialect: mysqlDialect,
})
