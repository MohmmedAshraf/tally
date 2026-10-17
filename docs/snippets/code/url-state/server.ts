import { createSchema, viewFromUrlString, viewToUrlString, type View } from 'tally-core'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'mrr', type: 'currency' }, { id: 'renewal', type: 'date' }],
})

export function viewFromRequest(request: Request): View {
  return viewFromUrlString(new URL(request.url).search, schema)
}

export function linkTo(view: View, path: string): string {
  const search = viewToUrlString(view, schema, { base: 'tab=overview' })
  return search === '' ? path : `${path}?${search}`
}
