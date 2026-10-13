import type { Query } from '../query/ast.ts'
import { parseQuery } from '../query/parse.ts'
import { printFilter, printSort } from '../query/print.ts'
import type { Schema } from '../schema/schema.ts'
import { defaultView, reconcileView, validateView, type View } from './view.ts'

const QUERY_KEY = 'q'
const VIEW_KEY = 'view'

function queryText(view: View, schema: Schema): string {
  const parts = [printFilter(view.filter, schema)]
  for (const sort of view.sort) parts.push(printSort(sort, schema))
  if (view.group !== undefined) parts.push(`group by ${view.group.column}`)
  return parts.filter((part) => part !== '').join(', ')
}

function rest(view: View): Omit<View, 'filter' | 'sort' | 'group'> {
  const { filter: _filter, sort: _sort, group: _group, ...others } = view
  return others
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeView(encoded: string): unknown {
  const decoded: unknown = JSON.parse(fromBase64Url(encoded))
  if (typeof decoded !== 'object' || decoded === null) return decoded
  return { ...decoded, sort: [] }
}

export function viewToSearchParams(view: View, schema: Schema): URLSearchParams {
  const params = new URLSearchParams()
  const text = queryText(view, schema)
  if (text !== '') params.set(QUERY_KEY, text)
  const base = rest(defaultView(schema))
  const current = rest(view)
  if (JSON.stringify(current) !== JSON.stringify(base)) {
    params.set(VIEW_KEY, toBase64Url(JSON.stringify(current)))
  }
  return params
}

export function viewFromSearchParams(params: URLSearchParams, schema: Schema): View {
  const base = defaultView(schema)
  const encoded = params.get(VIEW_KEY)
  const others = encoded === null ? rest(base) : rest(validateView(decodeView(encoded)))
  const text = params.get(QUERY_KEY) ?? ''
  const query: Query = text === '' ? { sort: [] } : parseQuery(text, schema).query
  return reconcileView(
    {
      ...others,
      ...(query.filter === undefined ? {} : { filter: query.filter }),
      sort: query.sort,
      ...(query.group === undefined ? {} : { group: query.group }),
    },
    schema,
  )
}

export function viewToUrlString(view: View, schema: Schema): string {
  return viewToSearchParams(view, schema).toString()
}

export function viewFromUrlString(search: string, schema: Schema): View {
  return viewFromSearchParams(new URLSearchParams(search), schema)
}
