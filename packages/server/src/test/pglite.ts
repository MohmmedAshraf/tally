import type { PGlite } from '@electric-sql/pglite'
import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from 'kysely'

class PgliteConnection implements DatabaseConnection {
  readonly #pg: PGlite

  constructor(pg: PGlite) {
    this.#pg = pg
  }

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.#pg.query<R>(compiled.sql, [...compiled.parameters])
    return { rows: result.rows, numAffectedRows: BigInt(result.affectedRows ?? 0) }
  }

  streamQuery(): AsyncIterableIterator<QueryResult<never>> {
    throw new Error('Streaming is not supported')
  }
}

class PgliteDriver implements Driver {
  readonly #pg: PGlite
  readonly #connection: PgliteConnection

  constructor(pg: PGlite) {
    this.#pg = pg
    this.#connection = new PgliteConnection(pg)
  }

  init(): Promise<void> {
    return this.#pg.waitReady
  }

  acquireConnection(): Promise<DatabaseConnection> {
    return Promise.resolve(this.#connection)
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin'))
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
  }

  releaseConnection(): Promise<void> {
    return Promise.resolve()
  }

  destroy(): Promise<void> {
    return this.#pg.close()
  }
}

export function pgliteDialect(pg: PGlite): Dialect {
  return {
    createDriver: () => new PgliteDriver(pg),
    createQueryCompiler: () => new PostgresQueryCompiler(),
    createAdapter: () => new PostgresAdapter(),
    createIntrospector: (db) => new PostgresIntrospector(db),
  }
}
