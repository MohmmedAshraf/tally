import type { Capabilities, DataSource, Mutation, MutationResult, RowPatch } from 'tally-core'
import { mutationResultSchema, queryResponseSchema, rowPatchSchema } from 'tally-protocol'

const capabilities: Capabilities = {
  filter: false,
  sort: true,
  group: false,
  search: false,
  aggregates: false,
  facets: false,
  pagination: 'offset',
  mutate: true,
  live: true,
}

export function createAccountsSource(base: string): DataSource {
  return {
    capabilities,
    async query(request, signal) {
      const params = new URLSearchParams()
      for (const sort of request.sort) params.append('sort', `${sort.column}:${sort.direction}`)
      if (request.page !== undefined && 'offset' in request.page) {
        params.set('offset', String(request.page.offset))
        params.set('limit', String(request.page.limit))
      }
      const response = await fetch(`${base}/accounts?${params.toString()}`, {
        signal: signal ?? null,
      })
      return queryResponseSchema.parse(await response.json())
    },
    async mutate(mutations: readonly Mutation[]): Promise<MutationResult> {
      const response = await fetch(`${base}/accounts`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mutations }),
      })
      return mutationResultSchema.parse(await response.json())
    },
    subscribe(onPatch: (patch: RowPatch) => void): () => void {
      const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/accounts/live`)
      socket.addEventListener('message', (event) => {
        const patch = rowPatchSchema.safeParse(JSON.parse(String(event.data)))
        if (patch.success) onPatch(patch.data)
      })
      return () => socket.close()
    },
  }
}
