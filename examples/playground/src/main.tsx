import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createArraySource, createSchema } from 'tally-core'
import { Tally, useGrid } from 'tally-react'
import 'tally-react/styles.css'
import { columns, makeRows } from './data.ts'

const schema = createSchema({ columns, key: 'id' })

const LOCALES = ['en-US', 'de-DE', 'ar-EG', 'ja-JP'] as const

type Locale = (typeof LOCALES)[number]

function isLocale(value: string): value is Locale {
  return LOCALES.some((entry) => entry === value)
}

function App() {
  const [source] = useState(() => createArraySource(makeRows(5000), schema))
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
