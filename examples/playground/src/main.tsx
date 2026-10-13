import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createArraySource, createSchema } from 'tally-core'
import { Tally, useGrid } from 'tally-react'
import 'tally-react/styles.css'
import { columns, makeRows } from './data.ts'

const schema = createSchema({ columns, key: 'id' })

function App() {
  const [source] = useState(() => createArraySource(makeRows(5000), schema))
  const grid = useGrid({
    schema,
    source,
    format: { locale: 'en-US', timeZone: 'UTC', numberingSystem: 'latn' },
  })
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Tally grid={grid} label="Accounts" />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
