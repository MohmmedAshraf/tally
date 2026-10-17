'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { ease } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { BrandIcon, type Brand } from '../brand-icon'
import { TallyMark } from '../tally-mark'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

interface Node {
  readonly name: string
  readonly sub: string
  readonly brand?: Brand
}

const front: readonly Node[] = [
  { name: 'React', sub: 'tally-react', brand: 'react' },
  { name: 'Vue', sub: 'tally-vue', brand: 'vue' },
  { name: 'Svelte', sub: 'tally-svelte', brand: 'svelte' },
  { name: 'Solid', sub: 'tally-solid', brand: 'solid' },
]

const back: readonly Node[] = [
  { name: 'Postgres', sub: 'tally-server', brand: 'postgres' },
  { name: 'SQLite', sub: 'tally-server', brand: 'sqlite' },
  { name: 'Laravel', sub: 'Eloquent', brand: 'laravel' },
  { name: 'Supabase', sub: 'PostgREST', brand: 'supabase' },
  { name: 'Any HTTP API', sub: 'protocol' },
]

const frontY = (index: number): number => 270 + (index - 1.5) * 120
const backY = (index: number): number => 270 + (index - 2) * 104

const cables = [
  ...front.map((_, index) => `M494 270 C 400 270, 360 ${frontY(index)}, 260 ${frontY(index)}`),
  ...back.map((_, index) => `M626 270 C 720 270, 760 ${backY(index)}, 860 ${backY(index)}`),
]

const trips = [
  { front: 0, back: 0, ask: 'mrr > 5k', native: 'where mrr > $1', row: 'Atlas Freight · $26,480' },
  {
    front: 1,
    back: 2,
    ask: 'plan is enterprise',
    native: "where('plan', 'enterprise')",
    row: 'Vector Cloud · $10,930',
  },
  { front: 2, back: 3, ask: 'growth < 0', native: '?growth=lt.0', row: 'Meridian Energy · $8,380' },
  { front: 3, back: 4, ask: 'status is trial', native: 'POST /query', row: 'Kestrel Air · $6,990' },
] as const

const accent = '#3c5cdd'
const brand = '#009b95'
const up = '#14874e'

const restShadow = '0 0 0 1px #e3e5e9, 0 20px 50px -24px rgba(37, 45, 66, 0.35)'
const litShadow = '0 0 0 2.5px #009b95, 0 20px 50px -24px rgba(37, 45, 66, 0.35)'

function Card({
  node,
  lit,
  x,
  y,
}: {
  readonly node: Node
  readonly lit: boolean
  readonly x: number
  readonly y: number
}): ReactNode {
  return (
    <motion.div
      className="absolute z-2 flex h-20 w-65 items-center gap-4 rounded-[20px] bg-white px-4"
      style={{ left: x, top: y - 40 }}
      initial={false}
      animate={{ scale: lit ? 1.04 : 1, boxShadow: lit ? litShadow : restShadow }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      <span className="flex size-[52px] flex-none items-center justify-center rounded-[15px] bg-[linear-gradient(160deg,#fff_0%,oklch(0.975_0.004_265)_60%,oklch(0.94_0.006_265)_100%)] shadow-[inset_0_1px_0_#fff,0_0_0_1px_oklch(0.9_0.006_265),0_6px_14px_-6px_oklch(0.3_0.03_268/.28)]">
        {node.brand === undefined ? (
          <span className="size-6 rounded-full border-2 border-[oklch(0.45_0.02_265)] shadow-[inset_7px_0_0_-5px_oklch(0.45_0.02_265),inset_-7px_0_0_-5px_oklch(0.45_0.02_265)]" />
        ) : (
          <BrandIcon brand={node.brand} size={28} />
        )}
      </span>
      <span className="flex flex-col gap-1">
        <b className="text-xl leading-none font-[650] tracking-[-0.02em]">{node.name}</b>
        <span className="font-mono text-[13px] leading-none text-ink-3">{node.sub}</span>
      </span>
    </motion.div>
  )
}

export function Adapters(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 32 * trips.length, settled: 16 })
  const trip = trips[Math.floor(tick / 32)] ?? trips[0]
  const leg = tick % 32
  const legs = [
    { at: 2, cable: trip.front, inbound: true, text: trip.ask, color: accent },
    { at: 9, cable: 4 + trip.back, inbound: false, text: trip.native, color: brand },
    { at: 16, cable: 4 + trip.back, inbound: true, text: trip.row, color: up },
    { at: 23, cable: trip.front, inbound: false, text: trip.row, color: up },
  ]
  const frontLit = (leg >= 2 && leg < 5) || leg >= 28
  const backLit = leg >= 14 && leg < 18
  const hubLit = (leg >= 8 && leg < 11) || (leg >= 21 && leg < 24)

  return (
    <Section label="Adapters">
      <SectionHeader
        index="07"
        label="Adapters"
        tone="var(--color-accent)"
        title="React, Vue, Svelte and Solid."
        subtitle="On Postgres, SQLite, Laravel, Supabase or any API."
      />
      <Reveal>
        <FitStage width={1120}>
          <div ref={stage} className="relative h-135">
            <svg
              width="1120"
              height="540"
              className="absolute inset-0 overflow-visible"
              aria-hidden
            >
              {cables.map((d) => (
                <g key={d}>
                  <path
                    d={d}
                    fill="none"
                    stroke="oklch(0.88 0.008 265)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path d={d} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              ))}
            </svg>
            {cables.map((d, index) => (
              <motion.span
                key={d}
                className="pointer-events-none absolute top-0 left-0 size-[9px] rounded-full"
                style={{
                  offsetPath: `path('${d}')`,
                  offsetRotate: '0deg',
                  background: index < 4 ? accent : brand,
                  boxShadow: `0 0 0 6px ${index < 4 ? 'rgba(60, 92, 221, 0.14)' : 'rgba(0, 155, 149, 0.16)'}`,
                }}
                animate={{
                  offsetDistance: index % 2 === 1 ? ['100%', '0%'] : ['0%', '100%'],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  duration: 2.2 + (index % 3) * 0.4,
                  ease: 'easeInOut',
                  repeat: Infinity,
                  delay: index * 0.37,
                  opacity: {
                    times: [0, 0.12, 0.88, 1],
                    duration: 2.2 + (index % 3) * 0.4,
                    repeat: Infinity,
                    delay: index * 0.37,
                  },
                }}
              />
            ))}
            <motion.div
              className="absolute top-40 left-[450px] size-55 rounded-full border-[1.5px] border-dashed border-[oklch(0.62_0.11_190/.35)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
            />
            <motion.div
              className="absolute top-51 left-[494px] z-2 flex size-33 items-center justify-center rounded-[36px] bg-white"
              initial={false}
              animate={{
                scale: hubLit ? 1.05 : 1,
                boxShadow: hubLit
                  ? '0 0 0 1px #e3e5e9, 0 24px 60px -20px rgba(0, 71, 68, 0.45), 0 0 60px 8px rgba(0, 155, 149, 0.35)'
                  : '0 0 0 1px #e3e5e9, 0 24px 60px -20px rgba(0, 71, 68, 0.45), 0 0 0px 0px rgba(0, 155, 149, 0)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <TallyMark size={84} />
            </motion.div>
            {front.map((node, index) => (
              <Card
                key={node.name}
                node={node}
                x={0}
                y={frontY(index)}
                lit={frontLit && index === trip.front}
              />
            ))}
            {back.map((node, index) => (
              <Card
                key={node.name}
                node={node}
                x={860}
                y={backY(index)}
                lit={backLit && index === trip.back}
              />
            ))}
            <AnimatePresence>
              {legs.map(
                (item) =>
                  leg >= item.at &&
                  leg < item.at + 7 && (
                    <motion.span
                      key={`${tick - leg}-${item.at}`}
                      className="pointer-events-none absolute top-0 left-0 z-4 flex h-9 items-center gap-[9px] rounded-[11px] bg-white px-[13px] font-mono text-sm font-medium whitespace-nowrap text-ink"
                      style={{
                        offsetPath: `path('${cables[item.cable] ?? ''}')`,
                        offsetRotate: '0deg',
                        offsetAnchor: '50% 150%',
                        boxShadow: `0 0 0 1.5px color-mix(in oklch, ${item.color} 45%, white), 0 14px 30px -12px oklch(0.3 0.05 268 / .4)`,
                      }}
                      initial={{ offsetDistance: item.inbound ? '100%' : '0%', opacity: 0 }}
                      animate={{ offsetDistance: item.inbound ? '0%' : '100%', opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        offsetDistance: { duration: 0.65, ease },
                        opacity: { duration: 0.2 },
                      }}
                    >
                      <span
                        className="size-2 flex-none rounded-[3px]"
                        style={{ background: item.color }}
                      />
                      {item.text}
                    </motion.span>
                  ),
              )}
            </AnimatePresence>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
