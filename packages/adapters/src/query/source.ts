import type { QueryClient, QueryKey } from '@tanstack/query-core'
import type {
  Column,
  DataSource,
  Mutation,
  MutationResult,
  QueryRequest,
  QueryResponse,
  RowPatch,
} from 'tally-core'

export interface QuerySourceOptions {
  readonly client: QueryClient
  readonly source: DataSource
  readonly queryKey?: QueryKey | undefined
  readonly staleTime?: number | undefined
  readonly gcTime?: number | undefined
}

export interface QuerySource extends DataSource {
  readonly queryKey: QueryKey
  invalidate(): Promise<void>
}

const DEFAULT_KEY: QueryKey = ['tally']

export function createQuerySource(options: QuerySourceOptions): QuerySource {
  const { client, source } = options
  const queryKey = options.queryKey ?? DEFAULT_KEY
  const queriesKey: QueryKey = [...queryKey, 'query']
  const timing = {
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
    ...(options.gcTime === undefined ? {} : { gcTime: options.gcTime }),
  }
  const invalidate = (): Promise<void> => client.invalidateQueries({ queryKey: queriesKey })
  const query = (request: QueryRequest): Promise<QueryResponse> =>
    client.fetchQuery({
      queryKey: [...queriesKey, request],
      queryFn: ({ signal }) => source.query(request, signal),
      ...timing,
    })
  const schema = (): Promise<readonly Column[]> =>
    client.fetchQuery({
      queryKey: [...queryKey, 'schema'],
      queryFn: () => source.schema?.() ?? [],
      staleTime: Infinity,
    })
  const mutate = async (mutations: readonly Mutation[]): Promise<MutationResult> => {
    const result = (await source.mutate?.(mutations)) ?? {
      accepted: false,
      errors: [{ message: 'Source is read only' }],
    }
    if (result.accepted) await invalidate()
    return result
  }
  const subscribe = (onPatch: (patch: RowPatch) => void): (() => void) =>
    source.subscribe?.((patch) => {
      void invalidate()
      onPatch(patch)
    }) ?? (() => undefined)
  return {
    capabilities: source.capabilities,
    queryKey,
    invalidate,
    query,
    ...(source.schema === undefined ? {} : { schema }),
    ...(source.mutate === undefined ? {} : { mutate }),
    ...(source.subscribe === undefined ? {} : { subscribe }),
  }
}
