'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { healthColor } from '@/lib/accounts'
import { ease, pop } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { Caret } from '../ui/caret'
import { HealthBar } from '../ui/cells'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const term = {
  ink: 'oklch(0.93 0.005 265)',
  dim: 'oklch(0.62 0.01 265)',
  green: 'oklch(0.78 0.14 150)',
  violet: 'oklch(0.75 0.14 300)',
  amber: 'oklch(0.8 0.13 80)',
  red: 'oklch(0.7 0.15 25)',
}

const requests = [
  {
    text: 'show health as a ring',
    point: 'renderer',
    added: '+7',
    removed: '-1',
    done: 'Health renders as a ring',
    start: 0,
  },
  {
    text: 'make the table compact',
    point: 'theme',
    added: '+1',
    removed: '-0',
    done: 'Rows are compact',
    start: 30,
  },
  {
    text: 'flag renewals in the next 45 days',
    point: 'views',
    added: '+6',
    removed: '-0',
    done: 'Renewal rule added',
    start: 60,
  },
]

const renewals = [
  { name: 'Atlas Freight', health: 42, date: 'Oct 29', days: 12 },
  { name: 'Northwind Labs', health: 67, date: 'Nov 17', days: 31 },
  { name: 'Vector Cloud', health: 79, date: 'Nov 30', days: 44 },
  { name: 'Quill & Co', health: 69, date: 'Aug 9', days: undefined },
  { name: 'Halcyon Health', health: 50, date: 'Jan 16', days: undefined },
  { name: 'Copper Analytics', health: 85, date: 'Sep 20', days: undefined },
]

const RING = 2 * Math.PI * 10

type Segment = readonly [text: string, color: string, bold?: boolean]

function Line({ segments }: { readonly segments: readonly Segment[] }): ReactNode {
  return (
    <motion.div
      className="whitespace-pre-wrap"
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {segments.map(([text, color, bold]) => (
        <span key={text} style={{ color, fontWeight: bold === true ? 600 : 400 }}>
          {text}
        </span>
      ))}
    </motion.div>
  )
}

function transcript(tick: number): { lines: ReactNode[]; typing: boolean } {
  const lines: ReactNode[] = []
  let typing = false
  if (tick >= 100) return { lines, typing }
  for (const request of requests) {
    const at = tick - request.start
    if (at < 2) continue
    const shown = Math.min(request.text.length, Math.floor((at - 2) * 2.4))
    if (shown < request.text.length) typing = true
    lines.push(
      <div key={`${request.start}-ask`} className="whitespace-pre-wrap">
        <span style={{ color: term.violet, fontWeight: 600 }}>{'> '}</span>
        <span style={{ color: term.ink }}>{request.text.slice(0, shown)}</span>
      </div>,
    )
    if (at >= 16)
      lines.push(
        <Line
          key={`${request.start}-where`}
          segments={[
            ['  ● ', term.violet],
            ['tally_where ', term.dim],
            [request.point, term.ink],
          ]}
        />,
      )
    if (at >= 20)
      lines.push(
        <Line
          key={`${request.start}-edit`}
          segments={[
            ['  ● ', term.amber],
            ['Edit ', term.dim],
            ['src/accounts/table.tsx ', term.ink],
            [`${request.added} `, term.green],
            [request.removed, term.red],
          ]}
        />,
      )
    if (at >= 24)
      lines.push(
        <Line
          key={`${request.start}-done`}
          segments={[
            ['  ✓ ', term.green, true],
            [request.done, term.green],
          ]}
        />,
      )
  }
  return { lines, typing }
}

function HealthRing({ health }: { readonly health: number }): ReactNode {
  return (
    <svg width="26" height="26" aria-hidden>
      <circle cx="13" cy="13" r="10" fill="none" stroke="oklch(0.93 0.004 265)" strokeWidth="3.5" />
      <circle
        cx="13"
        cy="13"
        r="10"
        fill="none"
        stroke={healthColor(health)}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${((RING * health) / 100).toFixed(1)} ${RING.toFixed(1)}`}
        transform="rotate(-90 13 13)"
      />
    </svg>
  )
}

export function Mcp(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 110, settled: 95 })
  const { lines, typing } = transcript(tick)
  const ring = tick >= 24 && tick < 100
  const compact = tick >= 54 && tick < 100
  const rule = tick >= 84 && tick < 100

  return (
    <Section label="tally-mcp-server">
      <SectionHeader
        index="05"
        label="tally-mcp-server"
        tone="var(--color-accent)"
        title="An MCP server for your coding agent."
        subtitle="It knows every extension point in Tally."
      />
      <Reveal>
        <FitStage width={1080}>
          <div ref={stage} className="flex items-start gap-7">
            <div className="flex h-105 w-140 flex-none flex-col gap-[9px] rounded-[18px] bg-[oklch(0.2_0.012_265)] px-[22px] pt-[18px] pb-6 font-mono text-sm leading-[1.55] text-[oklch(0.93_0.005_265)] shadow-[0_40px_80px_-30px_oklch(0.2_0.05_268/.5)]">
              <div className="flex gap-[7px] pb-2">
                <span className="size-[11px] rounded-full bg-[oklch(0.68_0.19_25)]" />
                <span className="size-[11px] rounded-full bg-[oklch(0.8_0.15_85)]" />
                <span className="size-[11px] rounded-full bg-[oklch(0.72_0.17_145)]" />
                <span className="ml-auto text-xs text-[oklch(0.62_0.01_265)]">
                  tally-mcp-server
                </span>
              </div>
              {lines}
              {(typing || tick >= 100 || tick < 2) && (
                <Caret color="oklch(0.75 0.14 300)" className="h-4 w-2" />
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_60px_-30px_oklch(0.3_0.04_268/.25)]">
              <div className="flex h-10 items-center border-b border-line bg-surface px-[18px] text-[12.5px] font-medium text-ink-2">
                <div className="flex-[1.5]">Account</div>
                <div className="flex-1">Health</div>
                <div className="flex-[1.2] text-right">Renewal</div>
              </div>
              {renewals.map((row, index) => {
                const flag = rule && row.days !== undefined
                return (
                  <motion.div
                    key={row.name}
                    className="flex items-center border-b border-line-soft px-[18px]"
                    initial={false}
                    animate={{
                      height: compact ? 38 : 52,
                      fontSize: compact ? '13px' : '14px',
                      backgroundColor: flag ? '#fff9eb' : '#ffffff',
                    }}
                    transition={{
                      duration: 0.5,
                      ease,
                      delay: index * 0.04,
                      backgroundColor: { duration: 0.4 },
                    }}
                  >
                    <div className="flex-[1.5] font-[550]">{row.name}</div>
                    <div className="flex flex-1 items-center gap-2">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {ring ? (
                          <motion.span
                            key="ring"
                            className="flex"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={pop}
                          >
                            <HealthRing health={row.health} />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="bar"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <HealthBar health={row.health} width={48} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <span className="font-mono text-[12.5px] font-medium text-ink-2">
                        {row.health}
                      </span>
                    </div>
                    <div className="flex flex-[1.2] items-center justify-end gap-2">
                      <span
                        className={`text-[13.5px] transition-colors ${flag ? 'font-semibold text-[oklch(0.5_0.12_65)]' : 'text-ink-2'}`}
                      >
                        {row.date}
                      </span>
                      <AnimatePresence>
                        {flag && (
                          <motion.span
                            key="flag"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={pop}
                            className="rounded-md bg-[oklch(0.93_0.06_80)] px-[7px] py-0.5 text-[11.5px] font-semibold text-[oklch(0.45_0.11_65)]"
                          >
                            {row.days}d
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
