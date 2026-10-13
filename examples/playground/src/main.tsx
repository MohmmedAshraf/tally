import { StrictMode, Suspense, use, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { connectHttpSource, type HttpConnection } from 'tally-adapters'
import {
  createArraySource,
  createSchema,
  type DataSource,
  type FormatContext,
  type Pagination,
  type Schema,
} from 'tally-core'
import { Tally, useGrid } from 'tally-react'
import 'tally-react/styles.css'
import 'tally-react/fonts.css'
import { columns, makeRows } from './data.ts'

const schema = createSchema({ columns, key: 'id' })

const LOCALES = ['en-US', 'de-DE', 'ar-EG', 'ja-JP'] as const

const PAGINATIONS: readonly Pagination[] = ['none', 'offset', 'cursor']

const rows = makeRows(5000)

type Locale = (typeof LOCALES)[number]

type Theme = 'light' | 'dark'

type Direction = 'ltr' | 'rtl'

type Transport = 'array' | 'http'

function isLocale(value: string): value is Locale {
  return LOCALES.some((entry) => entry === value)
}

let remote: Promise<HttpConnection> | undefined

function connect(): Promise<HttpConnection> {
  remote ??= connectHttpSource({ url: '/api/tally' })
  return remote
}

interface WorkbenchProps {
  readonly schema: Schema
  readonly source: DataSource
  readonly format: FormatContext
  readonly theme: Theme
  readonly dir: Direction
}

function Workbench({ schema: current, source, format, theme, dir }: WorkbenchProps): ReactNode {
  const grid = useGrid({ schema: current, source, format })
  return <Tally grid={grid} label="Accounts" theme={theme} dir={dir} />
}

function RemoteWorkbench(props: Omit<WorkbenchProps, 'schema' | 'source'>): ReactNode {
  const connection = use(connect())
  return <Workbench {...props} schema={connection.schema} source={connection.source} />
}

function App() {
  const [transport, setTransport] = useState<Transport>('array')
  const [pagination, setPagination] = useState<Pagination>('none')
  const [source, setSource] = useState(() => createArraySource(rows, schema))
  const [theme, setTheme] = useState<Theme>('light')
  const [dir, setDir] = useState<Direction>('ltr')
  const [locale, setLocale] = useState<Locale>('en-US')
  const [width, setWidth] = useState<'full' | 'phone'>('full')
  const format: FormatContext = { locale, timeZone: 'UTC', numberingSystem: 'latn' }
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme === 'dark' ? '#0f1013' : '#f4f4f6',
      }}
    >
      <div style={{ display: 'flex', gap: 8, padding: 8, fontFamily: 'system-ui', fontSize: 13 }}>
        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme}
        </button>
        <button type="button" onClick={() => setDir(dir === 'rtl' ? 'ltr' : 'rtl')}>
          {dir}
        </button>
        <select
          value={locale}
          onChange={(event) => {
            if (isLocale(event.target.value)) setLocale(event.target.value)
          }}
        >
          {LOCALES.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
        </select>
        <button type="button" onClick={() => setWidth(width === 'full' ? 'phone' : 'full')}>
          {width}
        </button>
        <button
          type="button"
          onClick={() => setTransport(transport === 'array' ? 'http' : 'array')}
        >
          {transport}
        </button>
        {transport === 'array' ? (
          <button
            type="button"
            onClick={() => {
              const next = PAGINATIONS[(PAGINATIONS.indexOf(pagination) + 1) % PAGINATIONS.length]
              if (next === undefined) return
              setPagination(next)
              setSource(createArraySource(source.rows(), schema, { pagination: next }))
            }}
          >
            {pagination}
          </button>
        ) : null}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: width === 'phone' ? 390 : undefined,
          margin: width === 'phone' ? '0 auto 16px' : '0 8px 8px',
          border: '1px solid #d9d9de',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {transport === 'array' ? (
          <Workbench schema={schema} source={source} format={format} theme={theme} dir={dir} />
        ) : (
          <Suspense fallback={null}>
            <RemoteWorkbench format={format} theme={theme} dir={dir} />
          </Suspense>
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
