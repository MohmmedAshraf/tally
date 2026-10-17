import { sql, type AliasedRawBuilder, type Kysely, type RawBuilder, type SqlBool } from 'kysely'
import {
  TallyError,
  dateFromDayNumber,
  groupKeyOf,
  type AggregateRequest,
  type Capabilities,
  type DataSource,
  type Facet,
  type Facets,
  type GroupSummary,
  type Mutation,
  type MutationResult,
  type QueryRequest,
  type QueryResponse,
  type RowData,
  type RowKey,
  type Schema,
} from 'tally-core'
import { mutationIssues, validateQueryRequest } from 'tally-protocol'
import { sqliteDialect, type SqlDialect } from '../dialect.ts'
import {
  BUCKET_ALIAS,
  createCompiler,
  type Bucket,
  type Compiler,
  type OrderPart,
  type Target,
} from './compile.ts'

export type SqlDatabase = Record<string, Record<string, unknown>>

export interface KyselyAdapterOptions {
  readonly db: Kysely<SqlDatabase>
  readonly table: string
  readonly schema: Schema
  readonly dialect?: SqlDialect | undefined
  readonly columns?: Readonly<Record<string, string>> | undefined
  readonly flags?: Readonly<Record<string, RawBuilder<SqlBool>>> | undefined
  readonly pagination?: 'offset' | 'cursor' | undefined
  readonly maxLimit?: number | undefined
  readonly mutable?: boolean | undefined
  readonly today?: string | undefined
  readonly bins?: number | undefined
  readonly maxTerms?: number | undefined
  readonly maxGroups?: number | undefined
  readonly onError?: ((error: unknown) => void) | undefined
}

export interface KyselyAdapter extends DataSource {
  schema(): Promise<Schema['columns']>
  mutate(mutations: readonly Mutation[]): Promise<MutationResult>
}

type Row = Record<string, unknown>

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ offset }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0
  try {
    const parsed: unknown = JSON.parse(atob(cursor.replaceAll('-', '+').replaceAll('_', '/')))
    if (typeof parsed === 'object' && parsed !== null && 'offset' in parsed) {
      const offset = parsed.offset
      if (typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= 0) return offset
    }
  } catch {
    return 0
  }
  return 0
}

interface Orderable<Q> {
  orderBy(expression: RawBuilder<unknown>, direction: 'asc' | 'desc'): Q
}

function applyOrder<Q extends Orderable<Q>>(query: Q, parts: readonly OrderPart[]): Q {
  return parts.reduce((current, part) => current.orderBy(part.expression, part.direction), query)
}

function count(value: unknown): number {
  return Number(value ?? 0)
}

function uniqueAggregates(requests: readonly AggregateRequest[]): readonly AggregateRequest[] {
  return [
    ...new Map(requests.map((request) => [`${request.column}:${request.fn}`, request])).values(),
  ]
}

async function sequence<T>(items: readonly T[], run: (item: T) => Promise<unknown>): Promise<void> {
  await items.reduce<Promise<unknown>>(async (previous, item) => {
    await previous
    return run(item)
  }, Promise.resolve())
}

export function createKyselyAdapter(options: KyselyAdapterOptions): KyselyAdapter {
  const { db, table, schema } = options
  const dialect = options.dialect ?? sqliteDialect
  const keyField = schema.keyField
  if (keyField === undefined) {
    throw new TallyError('invalid_column', 'Kysely adapter needs a key field, not a key function')
  }
  const pagination = options.pagination ?? 'offset'
  const maxLimit = options.maxLimit ?? 1000
  const bins = options.bins ?? 20
  const maxTerms = options.maxTerms ?? 50
  const maxGroups = options.maxGroups ?? 1000
  const capabilities: Capabilities = {
    filter: true,
    sort: true,
    group: true,
    search: true,
    aggregates: true,
    facets: true,
    pagination,
    mutate: options.mutable !== false,
    live: false,
  }
  const compiler: Compiler = createCompiler({
    schema,
    dialect,
    today: options.today ?? todayIso(),
    columns: options.columns,
    flags: options.flags,
  })
  const keyColumn = options.columns?.[keyField] ?? keyField
  const keyRef = compiler.target(keyField)?.ref ?? sql.ref(keyColumn)
  const hiddenKey = schema.column(keyField) === undefined
  const selection = [
    ...schema.columns.map((column) => compiler.require(column.id).ref.as(column.id)),
    ...(hiddenKey ? [keyRef.as(keyField)] : []),
  ]

  const hydrate = (row: Row): RowData => {
    const out: Record<string, unknown> = hiddenKey ? { [keyField]: row[keyField] } : {}
    for (const column of schema.columns) {
      out[column.id] = dialect.decode(schema.typeOf(column).kind, row[column.id])
    }
    return out
  }

  const from = (where: RawBuilder<SqlBool> | undefined) => {
    const query = db.selectFrom(table)
    return where === undefined ? query : query.where(where)
  }

  const groupMatch = (bucket: RawBuilder<unknown>): RawBuilder<string> =>
    sql<string>`coalesce(${dialect.text(bucket)}, '')`

  const bucketed = (
    bucket: Bucket,
    columns: readonly AliasedRawBuilder<unknown, string>[],
    where: RawBuilder<SqlBool> | undefined,
  ) => {
    const grouped = from(where)
      .select([bucket.expression.as(BUCKET_ALIAS), ...columns])
      .groupBy(bucket.expression)
    return applyOrder(db.selectFrom(grouped.as('tally_groups')).selectAll(), bucket.groupOrder)
  }

  const total = async (where: RawBuilder<SqlBool> | undefined): Promise<number> => {
    const row = await from(where)
      .select(sql`count(*)`.as('n'))
      .executeTakeFirst()
    return count(row?.['n'])
  }

  const aggregateExpression = (request: AggregateRequest): RawBuilder<unknown> => {
    const target = compiler.require(request.column)
    const present = compiler.present(target)
    switch (request.fn) {
      case 'count':
        return sql`count(${present})`
      case 'distinct':
        return sql`count(distinct ${present})`
      case 'sum':
        return sql`coalesce(sum(${present}), 0)`
      case 'avg':
        return sql`avg(${present})`
      case 'min':
        return sql`min(${present})`
      case 'max':
        return sql`max(${present})`
    }
  }

  const aggregateSelection = (requests: readonly AggregateRequest[]) =>
    requests.map((request, index) => aggregateExpression(request).as(`a${String(index)}`))

  const readAggregates = (
    requests: readonly AggregateRequest[],
    row: Row | undefined,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    requests.forEach((request, index) => {
      const target = compiler.require(request.column)
      const raw = row?.[`a${String(index)}`]
      const kind = request.fn === 'count' || request.fn === 'distinct' ? 'number' : target.type.kind
      const value = dialect.decode(kind, raw)
      out[`${request.column}:${request.fn}`] = value === null ? undefined : value
    })
    return out
  }

  const groups = async (
    request: QueryRequest,
    where: RawBuilder<SqlBool> | undefined,
  ): Promise<readonly GroupSummary[] | undefined> => {
    if (request.group === undefined) return undefined
    const bucket = compiler.bucket(request.group, request.sort)
    const aggregates = uniqueAggregates(request.aggregates ?? [])
    const rows = await bucketed(
      bucket,
      [sql`count(*)`.as('n'), ...aggregateSelection(aggregates)],
      where,
    )
      .limit(maxGroups)
      .execute()
    return rows.map((row) => {
      const value =
        bucket.target.type.kind === 'date'
          ? (row[BUCKET_ALIAS] ?? null)
          : dialect.decode(bucket.target.type.kind, row[BUCKET_ALIAS])
      return {
        key: groupKeyOf(value),
        value,
        count: count(row['n']),
        aggregates: readAggregates(aggregates, row),
      }
    })
  }

  const terms = async (target: Target, where: RawBuilder<SqlBool> | undefined): Promise<Facet> => {
    const present = sql<SqlBool>`(not ${compiler.isEmpty(target)})`
    const base = from(where).where(present)
    const ordered =
      target.type.kind === 'enum' && (target.column.options ?? []).length > 0
        ? applyOrder(base.select([target.ref.as('v'), sql`count(*)`.as('n')]).groupBy(target.ref), [
            { expression: compiler.rank(target), direction: 'asc' },
          ])
        : base
            .select([target.ref.as('v'), sql`count(*)`.as('n')])
            .groupBy(target.ref)
            .orderBy(sql`count(*)`, 'desc')
            .orderBy(target.ref, 'asc')
    const [rows, distinctRow] = await Promise.all([
      ordered.limit(maxTerms).execute(),
      from(where)
        .select(sql`count(distinct ${compiler.present(target)})`.as('n'))
        .executeTakeFirst(),
    ])
    return {
      kind: 'terms',
      terms: rows.map((row) => ({
        value: dialect.decode(target.type.kind, row['v']),
        count: count(row['n']),
      })),
      distinct: count(distinctRow?.['n']),
    }
  }

  const histogram = async (
    target: Target,
    where: RawBuilder<SqlBool> | undefined,
  ): Promise<Facet> => {
    const kind = target.type.kind === 'date' ? 'date' : 'number'
    const numeric = kind === 'date' ? dialect.dayNumber(target.ref) : target.ref
    const extent = await from(where)
      .select([sql`min(${numeric})`.as('lo'), sql`max(${numeric})`.as('hi')])
      .executeTakeFirst()
    const lo = extent?.['lo']
    const hi = extent?.['hi']
    if (lo === null || lo === undefined || hi === null || hi === undefined) {
      return { kind: 'histogram', min: undefined, max: undefined, bins: [] }
    }
    const min = Number(lo)
    const max = Number(hi)
    const span = max === min ? 1 : max - min
    const step = span / bins
    const index = dialect.floor(sql`(${dialect.float(numeric)} - ${min}) / ${step}`)
    const rows = await from(where)
      .where(sql<SqlBool>`${numeric} is not null`)
      .select([index.as('i'), sql`count(*)`.as('n')])
      .groupBy(sql`i`)
      .execute()
    const counts = Array.from({ length: bins }, () => 0)
    for (const row of rows) {
      const slot = Math.min(bins - 1, row['i'])
      counts[slot] = (counts[slot] ?? 0) + count(row['n'])
    }
    const point = (value: number): unknown =>
      kind === 'number' ? value : dateFromDayNumber(Math.round(value))
    return {
      kind: 'histogram',
      min: point(min),
      max: point(max),
      bins: counts.map((n, slot) => ({
        start: point(min + slot * step),
        end: point(min + (slot + 1) * step),
        count: n,
      })),
    }
  }

  const facets = async (
    ids: readonly string[] | undefined,
    where: RawBuilder<SqlBool> | undefined,
  ): Promise<Facets | undefined> => {
    if (ids === undefined) return undefined
    const entries = await Promise.all(
      [...new Set(ids)].flatMap((id) => {
        const target = compiler.target(id)
        if (target === undefined) return []
        if (
          target.type.facet === 'histogram' &&
          (target.type.kind === 'number' || target.type.kind === 'date')
        ) {
          return [histogram(target, where).then((facet) => [id, facet] as const)]
        }
        if (target.type.facet === 'terms') {
          return [terms(target, where).then((facet) => [id, facet] as const)]
        }
        return []
      }),
    )
    return Object.fromEntries(entries)
  }

  const page = (request: QueryRequest): { offset: number; limit: number } | undefined => {
    if (request.page === undefined) return undefined
    const limit = Math.min(maxLimit, request.page.limit)
    if ('offset' in request.page) return { offset: request.page.offset, limit }
    return { offset: decodeCursor(request.page.cursor), limit }
  }

  const query = async (request: QueryRequest): Promise<QueryResponse> => {
    validateQueryRequest(request, schema)
    const where = request.filter === undefined ? undefined : compiler.filter(request.filter)
    const bucket =
      request.group === undefined ? undefined : compiler.bucket(request.group, request.sort)
    const order = [...(bucket?.order ?? []), ...compiler.order(request.sort)]
    const rowsQuery = applyOrder(from(where).select(selection), [
      ...order,
      { expression: keyRef, direction: 'asc' },
    ])
    const slice = page(request)
    const paged =
      slice === undefined
        ? rowsQuery.limit(maxLimit)
        : bucket === undefined
          ? rowsQuery.limit(slice.limit).offset(slice.offset)
          : rowsQuery.where(
              groupMatch(bucket.expression),
              'in',
              db
                .selectFrom(
                  bucketed(bucket, [], where)
                    .limit(Math.max(0, Math.min(slice.limit, maxGroups - slice.offset)))
                    .offset(slice.offset)
                    .as('tally_page'),
                )
                .select(groupMatch(sql.ref(BUCKET_ALIAS)).as(BUCKET_ALIAS)),
            )
    const aggregates = uniqueAggregates(request.aggregates ?? [])
    const [rows, all, matched, summaries, aggregateRow, facetMap] = await Promise.all([
      paged.execute(),
      total(undefined),
      where === undefined ? undefined : total(where),
      groups(request, where),
      aggregates.length === 0
        ? undefined
        : from(where).select(aggregateSelection(aggregates)).executeTakeFirst(),
      facets(request.facets, where),
    ])
    const matchedCount = matched ?? all
    const pageable = summaries === undefined ? matchedCount : summaries.length
    const next = slice === undefined ? undefined : slice.offset + slice.limit
    return {
      rows: rows.map(hydrate),
      total: all,
      matched: matchedCount,
      ...(pagination === 'cursor' && next !== undefined && next < pageable
        ? { cursor: encodeCursor(next) }
        : {}),
      ...(summaries === undefined ? {} : { groups: summaries }),
      ...(aggregateRow === undefined
        ? {}
        : { aggregates: readAggregates(aggregates, aggregateRow) }),
      ...(facetMap === undefined ? {} : { facets: facetMap }),
    }
  }

  const encodeRow = (row: RowData): Record<string, unknown> => {
    const out: Record<string, unknown> = hiddenKey ? { [keyColumn]: row[keyField] } : {}
    for (const column of schema.columns) {
      if (column.id in row) {
        out[options.columns?.[column.id] ?? column.id] = dialect.encode(
          schema.typeOf(column).kind,
          row[column.id],
        )
      }
    }
    return out
  }

  const keysIn = (keys: readonly RowKey[]): RawBuilder<SqlBool> =>
    sql<SqlBool>`${keyRef} in (${sql.join(keys)})`

  const apply = async (trx: Kysely<SqlDatabase>, mutation: Mutation): Promise<void> => {
    const deletes = mutation.deleted.map((removal) => schema.keyOf(removal.row))
    if (deletes.length > 0) await trx.deleteFrom(table).where(keysIn(deletes)).execute()
    await sequence(mutation.inserted, (insert) =>
      trx.insertInto(table).values(encodeRow(insert.row)).execute(),
    )
    const patches = new Map<RowKey, Record<string, unknown>>()
    for (const change of mutation.changes) {
      const patch = patches.get(change.key) ?? {}
      patch[options.columns?.[change.column] ?? change.column] = dialect.encode(
        schema.typeOf(schema.requireColumn(change.column)).kind,
        change.to,
      )
      patches.set(change.key, patch)
    }
    await sequence([...patches.entries()], ([rowKey, patch]) =>
      trx
        .updateTable(table)
        .set(patch)
        .where(sql<SqlBool>`${keyRef} = ${rowKey}`)
        .execute(),
    )
  }

  const mutate = async (mutations: readonly Mutation[]): Promise<MutationResult> => {
    if (!capabilities.mutate) {
      return { accepted: false, errors: [{ message: 'Source is read only' }] }
    }
    const issues = mutationIssues({ version: 1, mutations }, schema)
    if (issues.length > 0) {
      return { accepted: false, errors: issues.map((message) => ({ message })) }
    }
    try {
      await db
        .transaction()
        .execute((trx) => sequence(mutations, (mutation) => apply(trx, mutation)))
    } catch (error) {
      options.onError?.(error)
      return { accepted: false, errors: [{ message: 'Mutation failed' }] }
    }
    const touched = [
      ...new Set(
        mutations.flatMap((mutation) => [
          ...mutation.changes.map((change) => change.key),
          ...mutation.inserted.map((insert) => schema.keyOf(insert.row)),
        ]),
      ),
    ]
    const rows =
      touched.length === 0
        ? []
        : (await db.selectFrom(table).select(selection).where(keysIn(touched)).execute()).map(
            hydrate,
          )
    return { accepted: true, rows }
  }

  return {
    capabilities,
    schema: () => Promise.resolve(schema.columns),
    query,
    mutate,
  }
}
