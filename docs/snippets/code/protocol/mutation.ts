import type { MutationResult } from 'tally-core'
import type { MutationRequest } from 'tally-protocol'

export const request: MutationRequest = {
  version: 1,
  mutations: [
    {
      id: 'm1',
      label: 'Edit MRR',
      at: 1792224000000,
      changes: [{ key: 7, column: 'mrr', from: 4200, to: 4800 }],
      inserted: [],
      deleted: [],
    },
  ],
}

export const result: MutationResult = {
  accepted: true,
  rows: [{ id: 7, account: 'Acme', plan: 'pro', mrr: 4800 }],
}
