import { connectHttpSource } from 'tally-adapters'
import { registry } from './rating.ts'

export const { schema, source } = await connectHttpSource({
  url: '/api/reviews',
  registry,
})
