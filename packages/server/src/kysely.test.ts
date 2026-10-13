import { DatabaseSync } from 'node:sqlite'
import { PGlite } from '@electric-sql/pglite'
import { Kysely, SqliteDialect, sql } from 'kysely'
import { createMutation, createSchema } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { postgresDialect, sqliteDialect, type SqlDialect } from './dialect.ts'
import { createKyselyAdapter, type SqlDatabase } from './kysely/adapter.ts'
import { nodeSqlite } from './node-sqlite.ts'
import { pgliteDialect } from './test/pglite.ts'

const TABLE = 'accounts'

const SQLITE_DDL = `create table ${TABLE} (
  id text primary key, account text, owner text, plan text, mrr real, seats integer,
  score real, growth real, health integer, renewal text, active integer, email text,
  website text, tenure integer)`

const POSTGRES_DDL = `create table ${TABLE} (
  id text primary key, account text, owner text, plan text, mrr double precision, seats integer,
  score double precision, growth double precision, health integer, renewal date, active boolean,
  email text, website text, tenure integer)`

interface Target {
  readonly name: string
  readonly dialect: SqlDialect
  readonly open: () => Promise<Kysely<SqlDatabase>>
}

const targets: readonly Target[] = [
  {
    name: 'sqlite',
    dialect: sqliteDialect,
    open: async () => {
      const db = new Kysely<SqlDatabase>({
        dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
      })
      await sql.raw(SQLITE_DDL).execute(db)
      return db
    },
  },
  {
    name: 'postgres',
    dialect: postgresDialect,
    open: async () => {
      const pg = new PGlite({ parsers: { 1082: (value: string) => value } })
      const db = new Kysely<SqlDatabase>({ dialect: pgliteDialect(pg) })
      await sql.raw(POSTGRES_DDL).execute(db)
      return db
    },
  },
]

async function seed(db: Kysely<SqlDatabase>, dialect: SqlDialect): Promise<void> {
  const rows = conformanceRows.map((row) =>
    Object.fromEntries(
      conformanceSchema.columns.map((column) => [
        column.id,
        dialect.encode(conformanceSchema.typeOf(column).kind, row[column.id]),
      ]),
    ),
  )
  await db.insertInto(TABLE).values(rows).execute()
}

describe.each(targets)('createKyselyAdapter on $name', ({ dialect, open }) => {
  let db: Kysely<SqlDatabase>

  beforeAll(async () => {
    db = await open()
    await seed(db, dialect)
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('conforms with offset pagination', async () => {
    const adapter = createKyselyAdapter({
      db,
      table: TABLE,
      schema: conformanceSchema,
      dialect,
      today: CONFORMANCE_TODAY,
    })
    const report = await runConformance((request) => adapter.query(request), {
      capabilities: adapter.capabilities,
    })
    expect(report.failures).toEqual([])
  })

  it('conforms with cursor pagination', async () => {
    const adapter = createKyselyAdapter({
      db,
      table: TABLE,
      schema: conformanceSchema,
      dialect,
      today: CONFORMANCE_TODAY,
      pagination: 'cursor',
    })
    const report = await runConformance((request) => adapter.query(request), {
      capabilities: adapter.capabilities,
    })
    expect(report.failures).toEqual([])
    const first = await adapter.query({ version: 1, sort: [], page: { limit: 50 } })
    expect(first.cursor).toBeDefined()
    const rest = await adapter.query({
      version: 1,
      sort: [],
      page: { cursor: first.cursor, limit: 50 },
    })
    expect(rest.rows).toHaveLength(10)
    expect(rest.cursor).toBeUndefined()
    const bad = await adapter.query({ version: 1, sort: [], page: { cursor: '!!', limit: 5 } })
    expect(bad.rows).toHaveLength(5)
  })

  it('rejects invalid requests before touching the database', async () => {
    const adapter = createKyselyAdapter({ db, table: TABLE, schema: conformanceSchema, dialect })
    await expect(
      adapter.query({ version: 1, sort: [{ column: 'nope', direction: 'asc' }] }),
    ).rejects.toMatchObject({ code: 'invalid_query' })
  })

  it('clamps the page size and compiles flags', async () => {
    const adapter = createKyselyAdapter({
      db,
      table: TABLE,
      schema: conformanceSchema,
      dialect,
      maxLimit: 3,
      flags: { paying: sql`${sql.ref('mrr')} > 0` },
    })
    const page = await adapter.query({ version: 1, sort: [], page: { offset: 0, limit: 100 } })
    expect(page.rows).toHaveLength(3)
    const paying = await adapter.query({
      version: 1,
      sort: [],
      filter: { type: 'flag', name: 'paying' },
    })
    expect(paying.matched).toBe(conformanceRows.filter((row) => Number(row['mrr']) > 0).length)
    const unknown = await adapter.query({
      version: 1,
      sort: [],
      filter: { type: 'flag', name: 'x' },
    })
    expect(unknown.matched).toBe(0)
  })

  it('applies mutations in a transaction and returns canonical rows', async () => {
    const adapter = createKyselyAdapter({ db, table: TABLE, schema: conformanceSchema, dialect })
    const result = await adapter.mutate([
      createMutation({
        label: 'Edit',
        changes: [
          { key: 'acc_002', column: 'mrr', from: 925, to: 1000 },
          { key: 'acc_002', column: 'active', from: true, to: false },
        ],
        inserted: [{ row: { id: 'acc_999', account: 'new', plan: 'pro', mrr: 5, active: true } }],
        deleted: [{ row: { id: 'acc_003' }, index: 2 }],
      }),
    ])
    expect(result.accepted).toBe(true)
    const byKey = new Map(result.rows?.map((row) => [row['id'], row]))
    expect(byKey.get('acc_002')).toMatchObject({ mrr: 1000, active: false })
    expect(byKey.get('acc_999')).toMatchObject({
      account: 'new',
      plan: 'pro',
      mrr: 5,
      active: true,
      seats: null,
    })
    const after = await adapter.query({ version: 1, sort: [] })
    expect(after.total).toBe(60)
    expect(after.rows.some((row) => row['id'] === 'acc_003')).toBe(false)
    const rejected = await adapter.mutate([
      createMutation({
        label: 'Bad',
        changes: [{ key: 'acc_001', column: 'mrr', from: 0, to: 'x' }],
      }),
    ])
    expect(rejected).toEqual({
      accepted: false,
      errors: [{ message: 'mutations.0.changes.0.to: expected a number value' }],
    })
    const failed = await adapter.mutate([
      createMutation({ label: 'Dup', inserted: [{ row: { id: 'acc_001', account: 'dup' } }] }),
    ])
    expect(failed.accepted).toBe(false)
  })

  it('refuses mutations when read only', async () => {
    const adapter = createKyselyAdapter({
      db,
      table: TABLE,
      schema: conformanceSchema,
      dialect,
      mutable: false,
    })
    expect(adapter.capabilities.mutate).toBe(false)
    expect(await adapter.mutate([])).toEqual({
      accepted: false,
      errors: [{ message: 'Source is read only' }],
    })
  })
})

describe('createKyselyAdapter', () => {
  it('maps column ids to SQL column names', async () => {
    const db = new Kysely<SqlDatabase>({
      dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
    })
    await sql
      .raw('create table t (pk integer primary key, full_name text, is_ok integer)')
      .execute(db)
    await db
      .insertInto('t')
      .values([
        { pk: 1, full_name: 'Ann', is_ok: 1 },
        { pk: 2, full_name: 'Bob', is_ok: 0 },
      ])
      .execute()
    const schema = createSchema({
      columns: [{ id: 'id', type: 'int' }, { id: 'name' }, { id: 'ok', type: 'bool' }],
    })
    const adapter = createKyselyAdapter({
      db,
      table: 't',
      schema,
      columns: { id: 'pk', name: 'full_name', ok: 'is_ok' },
    })
    const response = await adapter.query({
      version: 1,
      sort: [{ column: 'name', direction: 'desc' }],
      filter: { type: 'condition', column: 'ok', op: 'eq', value: false },
    })
    expect(response.rows).toEqual([{ id: 2, name: 'Bob', ok: false }])
    expect(await adapter.schema()).toBe(schema.columns)
    await db.destroy()
  })

  it('selects, orders and mutates by a key that is not a column', async () => {
    const db = new Kysely<SqlDatabase>({
      dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
    })
    await sql.raw('create table t (pk integer primary key, name text)').execute(db)
    await db
      .insertInto('t')
      .values([
        { pk: 1, name: 'Ann' },
        { pk: 2, name: 'Bob' },
      ])
      .execute()
    const schema = createSchema({ columns: [{ id: 'name' }], key: 'id' })
    const adapter = createKyselyAdapter({ db, table: 't', schema, columns: { id: 'pk' } })
    const response = await adapter.query({ version: 1, sort: [] })
    expect(response.rows).toEqual([
      { id: 1, name: 'Ann' },
      { id: 2, name: 'Bob' },
    ])
    const result = await adapter.mutate([
      createMutation({
        label: 'edit',
        changes: [{ key: 2, column: 'name', from: 'Bob', to: 'Bo' }],
        inserted: [{ row: { id: 3, name: 'Cy' } }],
        deleted: [{ row: { id: 1, name: 'Ann' }, index: 0 }],
      }),
    ])
    expect(result).toEqual({
      accepted: true,
      rows: [
        { id: 2, name: 'Bo' },
        { id: 3, name: 'Cy' },
      ],
    })
    await db.destroy()
  })

  it('needs a key field', () => {
    const db = new Kysely<SqlDatabase>({
      dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
    })
    const schema = createSchema({ columns: [{ id: 'a' }], key: (row) => String(row['a']) })
    expect(() => createKyselyAdapter({ db, table: 't', schema })).toThrow(/key field/)
  })
})
