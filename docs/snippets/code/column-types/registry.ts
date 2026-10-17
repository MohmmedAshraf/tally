import { createDefaultRegistry, createSchema } from 'tally-core'

const registry = createDefaultRegistry()
registry.register({ ...registry.get('text'), name: 'sku', card: 'meta' })

export const schema = createSchema({
  registry,
  columns: [{ id: 'sku', type: 'sku' }],
})
