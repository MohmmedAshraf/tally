import type { GroupGranularity } from '../query/ast.ts'
import { parseQuery } from '../query/parse.ts'
import { printQuery } from '../query/print.ts'
import type { Schema } from '../schema/schema.ts'
import { isAggregate, type AggregateName } from '../types/aggregate.ts'
import {
  defaultView,
  reconcileView,
  validateView,
  type ColumnState,
  type Density,
  type View,
} from './view.ts'

export interface ViewUrlOptions {
  readonly param?: string | undefined
  readonly base?: string | URLSearchParams | undefined
}

const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious']
const GRANULARITIES: readonly GroupGranularity[] = ['day', 'week', 'month', 'quarter', 'year']
const EXTRA_KEYS = ['rules', 'pinnedRows', 'expanded', 'collapsedGroups'] as const
const KEYS = ['granularity', 'density', 'columns', 'footer', 'state'] as const
const READABLE: Readonly<Record<string, string>> = {
  '%2C': ',',
  '%3A': ':',
  '%28': '(',
  '%29': ')',
  '%2F': '/',
}

type Extra = Pick<View, (typeof EXTRA_KEYS)[number]>

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function escapeId(id: string): string {
  return id.replace(/[%,:]/g, encodeURIComponent)
}

function columnToken(state: ColumnState): string {
  const parts = [escapeId(state.id)]
  if (state.width !== undefined) parts.push(String(state.width))
  if (state.flex !== undefined) parts.push(`${state.flex}fr`)
  if (state.hidden === true) parts.push('hidden')
  if (state.pin !== undefined) parts.push(state.pin)
  return parts.join(':')
}

function parseColumn(token: string): ColumnState | undefined {
  const [id = '', ...parts] = token.split(':')
  if (id === '') return undefined
  let state: ColumnState = { id: decodeURIComponent(id) }
  for (const part of parts) {
    if (part === 'hidden') state = { ...state, hidden: true }
    else if (part === 'left' || part === 'right') state = { ...state, pin: part }
    else if (part.endsWith('fr')) {
      const flex = Number(part.slice(0, -2))
      if (Number.isFinite(flex) && flex >= 0) state = { ...state, flex }
    } else {
      const width = Number(part)
      if (Number.isFinite(width) && width > 0) state = { ...state, width }
    }
  }
  return state
}

function columnsText(columns: readonly ColumnState[]): string {
  return columns.map(columnToken).join(',')
}

function footerText(footer: View['footer']): string {
  return Object.entries(footer)
    .map(([column, fn]) => `${escapeId(column)}:${fn}`)
    .join(',')
}

function parseFooter(text: string): Record<string, AggregateName> {
  const footer: Record<string, AggregateName> = {}
  for (const entry of text.split(',')) {
    const [column = '', fn] = entry.split(':')
    if (column !== '' && isAggregate(fn)) footer[decodeURIComponent(column)] = fn
  }
  return footer
}

function extraOf(view: View): Extra {
  return {
    rules: view.rules,
    pinnedRows: view.pinnedRows,
    expanded: view.expanded,
    collapsedGroups: view.collapsedGroups,
  }
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
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function viewToSearchParams(
  view: View,
  schema: Schema,
  options: ViewUrlOptions = {},
): URLSearchParams {
  const param = options.param ?? 'q'
  const params = new URLSearchParams(options.base)
  for (const key of [param, ...KEYS]) params.delete(key)
  const base = defaultView(schema)
  const text = printQuery(view, schema)
  if (text !== '') params.set(param, text)
  if (view.group?.granularity !== undefined) params.set('granularity', view.group.granularity)
  if (view.density !== base.density) params.set('density', view.density)
  const columns = columnsText(view.columns)
  if (columns !== columnsText(base.columns)) params.set('columns', columns)
  const footer = footerText(view.footer)
  if (footer !== footerText(base.footer)) params.set('footer', footer)
  const extra = extraOf(view)
  if (!same(extra, extraOf(base))) params.set('state', toBase64Url(JSON.stringify(extra)))
  return params
}

export function viewFromSearchParams(
  params: URLSearchParams,
  schema: Schema,
  options: Pick<ViewUrlOptions, 'param'> = {},
): View {
  const base = defaultView(schema)
  const encoded = params.get('state')
  const decoded: unknown = encoded === null ? {} : JSON.parse(fromBase64Url(encoded))
  const extra = extraOf(
    validateView(
      typeof decoded === 'object' && decoded !== null ? { ...base, ...decoded } : decoded,
    ),
  )
  const text = params.get(options.param ?? 'q') ?? ''
  const query = text === '' ? { sort: [] } : parseQuery(text, schema).query
  const density = params.get('density')
  const granularity = GRANULARITIES.find((unit) => unit === params.get('granularity'))
  const columns = params.get('columns')
  const footer = params.get('footer')
  return reconcileView(
    {
      ...base,
      ...extra,
      ...(query.filter === undefined ? {} : { filter: query.filter }),
      sort: query.sort,
      ...(query.group === undefined
        ? {}
        : {
            group: granularity === undefined ? query.group : { ...query.group, granularity },
          }),
      density: DENSITIES.find((option) => option === density) ?? base.density,
      ...(columns === null
        ? {}
        : {
            columns: columns.split(',').flatMap((token) => {
              const state = parseColumn(token)
              return state === undefined ? [] : [state]
            }),
          }),
      ...(footer === null ? {} : { footer: parseFooter(footer) }),
    },
    schema,
  )
}

export function viewToUrlString(view: View, schema: Schema, options: ViewUrlOptions = {}): string {
  return viewToSearchParams(view, schema, options)
    .toString()
    .replace(/%2C|%3A|%28|%29|%2F/g, (match) => READABLE[match] ?? match)
}

export function viewFromUrlString(
  search: string,
  schema: Schema,
  options: Pick<ViewUrlOptions, 'param'> = {},
): View {
  return viewFromSearchParams(new URLSearchParams(search), schema, options)
}
