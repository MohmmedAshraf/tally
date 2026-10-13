import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createArraySource, createSchema, type Pagination } from 'tally-core'
import { Tally, useGrid } from 'tally-react'
import 'tally-react/styles.css'
import { columns, makeRows } from './data.ts'

const schema = createSchema({ columns, key: 'id' })

const LOCALES = ['en-US', 'de-DE', 'ar-EG', 'ja-JP'] as const

const PAGINATIONS: readonly Pagination[] = ['none', 'offset', 'cursor']

const rows = makeRows(5000)

type Locale = (typeof LOCALES)[number]

function isLocale(value: string): value is Locale {
  return LOCALES.some((entry) => entry === value)
}

function App() {
  const [pagination, setPagination] = useState<Pagination>('none')
  const [source, setSource] = useState(() => createArraySource(rows, schema))
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')
  const [locale, setLocale] = useState<Locale>('en-US')
  const [width, setWidth] = useState<'full' | 'phone'>('full')
  const grid = useGrid({
    schema,
    source,
    format: { locale, timeZone: 'UTC', numberingSystem: 'latn' },
  })
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
          onClick={() => {
            const next = PAGINATIONS[(PAGINATIONS.indexOf(pagination) + 1) % PAGINATIONS.length]
            if (next === undefined) return
            setPagination(next)
            setSource(createArraySource(source.rows(), schema, { pagination: next }))
          }}
        >
          {pagination}
        </button>
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
        <Tally grid={grid} label="Accounts" theme={theme} dir={dir} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
