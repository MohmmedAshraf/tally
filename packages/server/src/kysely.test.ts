import { DatabaseSync } from 'node:sqlite'
import { PGlite } from '@electric-sql/pglite'
import { Kysely, MysqlDialect, SqliteDialect, sql } from 'kysely'
import { createPool } from 'mysql2'
import { createArraySource, createMutation, createSchema, type QueryRequest } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mysqlDialect, postgresDialect, sqliteDialect, type SqlDialect } from './dialect.ts'
import { createKyselyAdapter, type SqlDatabase } from './kysely/adapter.ts'
import { nodeSqlite } from './node-sqlite.ts'
import { pgliteDialect } from './test/pglite.ts'

const TABLE = 'accounts'

const OWNERS_DDL = 'create table owners (id integer primary key, owner text, mrr integer)'

const ownerSchema = createSchema({
  columns: [
    { id: 'id', type: 'int' },
    { id: 'owner', type: 'person' },
    { id: 'mrr', type: 'int' },
  ],
  key: 'id',
})

const ownerRows = [
  { id: 1, owner: 'Ann', mrr: 10 },
  { id: 2, owner: null, mrr: 20 },
  { id: 3, owner: 'bob', mrr: 30 },
  { id: 4, owner: '', mrr: 40 },
  { id: 5, owner: 'Cy', mrr: 50 },
  { id: 6, owner: 'Ann', mrr: 60 },
  { id: 7, owner: null, mrr: 70 },
]

const SQLITE_DDL = `create table ${TABLE} (
  id text primary key, account text, owner text, plan text, mrr real, seats integer,
  score real, growth real, health integer, renewal text, active integer, email text,
  website text, tenure integer)`

const POSTGRES_DDL = `create table ${TABLE} (
  id text primary key, account text, owner text, plan text, mrr double precision, seats integer,
  score double precision, growth double precision, health integer, renewal date, active boolean,
  email text, website text, tenure integer)`

const MYSQL_DDL = `create table ${TABLE} (
  id varchar(64) primary key, account text, owner text, plan text, mrr double, seats integer,
  score double, growth double, health integer, renewal date, active boolean, email text,
  website text, tenure integer)`

const MYSQL_URL = process.env['TALLY_MYSQL_URL']

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
  ...(MYSQL_URL === undefined
    ? []
    : [
        {
          name: 'mysql',
          dialect: mysqlDialect,
          open: async () => {
            const db = new Kysely<SqlDatabase>({
              dialect: new MysqlDialect({ pool: createPool({ uri: MYSQL_URL }) }),
            })
            await sql.raw(`drop table if exists ${TABLE}, owners`).execute(db)
            await sql.raw(MYSQL_DDL).execute(db)
            return db
          },
        },
      ]),
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
    await sql.raw(OWNERS_DDL).execute(db)
    await db.insertInto('owners').values(ownerRows).execute()
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
    const unpaged = await adapter.query({ version: 1, sort: [] })
    expect(unpaged.rows).toHaveLength(3)
    expect(unpaged.matched).toBe(conformanceRows.length)
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
    const inherited = await Promise.all(
      ['constructor', '__proto__', 'toString'].map((name) =>
        adapter.query({ version: 1, sort: [], filter: { type: 'flag', name } }),
      ),
    )
    expect(inherited.map((response) => response.matched)).toEqual([0, 0, 0])
  })

  it('applies mutations in a transaction and returns canonical rows', async () => {
    const errors: unknown[] = []
    const adapter = createKyselyAdapter({
      db,
      table: TABLE,
      schema: conformanceSchema,
      dialect,
      onError: (error) => errors.push(error),
    })
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
    expect(failed).toEqual({ accepted: false, errors: [{ message: 'Mutation failed' }] })
    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toMatch(/unique|duplicate/i)
  })

  it('pages groups with the empty group last, like the in-memory engine', async () => {
    const adapter = createKyselyAdapter({ db, table: 'owners', schema: ownerSchema, dialect })
    const requests: readonly QueryRequest[] = [
      { version: 1, sort: [], group: { column: 'owner' }, page: { offset: 2, limit: 2 } },
      {
        version: 1,
        sort: [{ column: 'owner', direction: 'desc' }],
        group: { column: 'owner' },
        aggregates: [{ column: 'mrr', fn: 'sum' }],
        page: { offset: 0, limit: 4 },
      },
    ]
    const memory = createArraySource(ownerRows, ownerSchema, { pagination: 'offset' })
    const responses = await Promise.all(requests.map((request) => adapter.query(request)))
    const expected = await Promise.all(requests.map((request) => memory.query(request)))
    expect(responses).toEqual(expected)
    expect(responses[0]?.rows.map((row) => row['id'])).toEqual([5, 2, 4, 7])
    expect(responses[1]?.groups?.map((group) => group.key)).toEqual(['Cy', 'bob', 'Ann', ''])
    expect(responses[1]?.groups?.at(-1)?.aggregates).toEqual({ 'mrr:sum': 130 })
  })

  it('caps group summaries and the group pages behind them', async () => {
    const adapter = createKyselyAdapter({
      db,
      table: 'owners',
      schema: ownerSchema,
      dialect,
      pagination: 'cursor',
      maxGroups: 2,
    })
    const first = await adapter.query({
      version: 1,
      sort: [],
      group: { column: 'owner' },
      page: { limit: 2 },
    })
    expect(first.groups?.map((group) => group.key)).toEqual(['Ann', 'bob'])
    expect(first.rows.map((row) => row['id'])).toEqual([1, 6, 3])
    expect(first.cursor).toBeUndefined()
    const beyond = await adapter.query({
      version: 1,
      sort: [],
      group: { column: 'owner' },
      page: { offset: 2, limit: 2 },
    })
    expect(beyond.rows).toEqual([])
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

  it('runs each requested facet and aggregate once', async () => {
    const statements: string[] = []
    const db = new Kysely<SqlDatabase>({
      dialect: new SqliteDialect({ database: nodeSqlite(new DatabaseSync(':memory:')) }),
      log: (event) => {
        statements.push(event.query.sql)
      },
    })
    await sql.raw('create table t (id integer primary key, mrr real)').execute(db)
    const schema = createSchema({ columns: [{ id: 'mrr', type: 'number' }] })
    const adapter = createKyselyAdapter({ db, table: 't', schema })
    statements.length = 0
    await adapter.query({ version: 1, sort: [], facets: ['mrr'] })
    const single = statements.length
    statements.length = 0
    const response = await adapter.query({
      version: 1,
      sort: [],
      facets: Array.from({ length: 50 }, () => 'mrr'),
      aggregates: Array.from({ length: 50 }, () => ({ column: 'mrr', fn: 'sum' as const })),
    })
    expect(statements).toHaveLength(single + 1)
    expect(response.aggregates).toEqual({ 'mrr:sum': 0 })
    await db.destroy()
  })
})
