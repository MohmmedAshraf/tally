import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'Tally, the open-source data table'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function onest(weight: 400 | 700): Promise<Buffer> {
  return readFile(join(process.cwd(), `assets/fonts/onest-${weight}.woff`))
}

const line =
  'Meet Tally, the open-source data table. Typed columns, a query language, live data and AI, built in.'

const cells = [0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => ({ row, column })))

export default async function OpengraphImage(): Promise<ImageResponse> {
  const [bold, regular] = await Promise.all([onest(700), onest(400)])
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: '#040509',
        color: '#f4f5f8',
        fontFamily: 'Onest',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          {cells.map(({ row, column }) => (
            <rect
              key={`${row}-${column}`}
              x={6 + column * 22}
              y={6 + row * 22}
              width="16"
              height="16"
              rx="4"
              fill="#ffffff"
              fillOpacity="0.18"
            />
          ))}
          <rect
            x="24.5"
            y="24.5"
            width="23"
            height="23"
            rx="7.5"
            fill="none"
            stroke="#009b95"
            strokeWidth="2"
          />
          <rect x="28" y="28" width="16" height="16" rx="4" fill="#009b95" />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.045em' }}>tally</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 104,
            fontWeight: 700,
            lineHeight: 0.96,
            letterSpacing: '-0.05em',
          }}
        >
          <span>Every app ends up</span>
          <span style={{ display: 'flex' }}>
            with a&nbsp;<span style={{ color: '#7498ff' }}>table.</span>
          </span>
        </div>
        <div style={{ fontSize: 30, lineHeight: 1.4, color: '#83868e', maxWidth: 900 }}>{line}</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Onest', data: bold, weight: 700, style: 'normal' },
        { name: 'Onest', data: regular, weight: 400, style: 'normal' },
      ],
    },
  )
}
