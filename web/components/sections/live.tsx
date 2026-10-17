'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { accounts, money } from '@/lib/accounts'
import { alpha, hex } from '@/lib/colors'
import { useTicks } from '@/lib/use-ticks'
import {
  AccountCells,
  cardClass,
  ROW_HEIGHT,
  rowClass,
  TableFoot,
  TableHead,
} from '../ui/account-table'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const tracked = accounts.slice(0, 8)

interface Change {
  readonly seq: number
  readonly index: number
  readonly from: number
  readonly to: number
  readonly moved: number
}

interface Feed {
  readonly mrr: readonly number[]
  readonly change: Change | undefined
}

function noise(seed: number): number {
  const value = Math.sin(seed * 91.7 + 17.3) * 43758.5453
  return value - Math.floor(value)
}

function ranking(mrr: readonly number[]): number[] {
  return mrr.map((_, index) => index).toSorted((a, b) => (mrr[b] ?? 0) - (mrr[a] ?? 0))
}

function next(feed: Feed): Feed {
  const seq = (feed.change?.seq ?? 0) + 1
  const index = Math.floor(noise(seq * 7) * tracked.length)
  const from = feed.mrr[index] ?? 0
  const delta = Math.round(((noise(seq * 3 + 50) - 0.42) * 9000) / 10) * 10 || 420
  const to = Math.max(300, from + delta)
  const mrr = feed.mrr.map((value, at) => (at === index ? to : value))
  const moved = ranking(feed.mrr).indexOf(index) - ranking(mrr).indexOf(index)
  return { mrr, change: { seq, index, from, to, moved } }
}

const up = hex.upInk
const down = hex.downInk

export function Live(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 9, settled: 8 })
  const last = useRef(tick)
  const [feed, setFeed] = useState<Feed>({
    mrr: tracked.map((item) => item.mrr),
    change: undefined,
  })

  useEffect(() => {
    if (tick === 0 && last.current === 8) setFeed(next)
    last.current = tick
  }, [tick])

  const order = ranking(feed.mrr)
  const change = feed.change
  const rising = change !== undefined && change.to >= change.from
  const total = feed.mrr.reduce((sum, value) => sum + value, 0)

  return (
    <Section label="Live updates">
      <SectionHeader
        index="04"
        label="Live updates"
        tone="var(--color-up)"
        title="Live data, in place."
        subtitle="Values flash, rows re-rank, undo still works."
      />
      <Reveal>
        <FitStage width={1120}>
          <div ref={stage} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3.5">
              <span className="inline-flex h-[34px] items-center gap-[9px] rounded-full bg-[oklch(0.95_0.04_155)] px-3.5 text-sm font-semibold text-[oklch(0.45_0.13_155)]">
                <motion.span
                  className="size-2 rounded-full bg-up"
                  animate={{
                    boxShadow: [
                      '0 0 0 0 oklch(0.55 0.13 155 / .5)',
                      '0 0 0 9px oklch(0.55 0.13 155 / 0)',
                    ],
                  }}
                  transition={{ duration: 1.4, ease: 'easeOut', repeat: Infinity }}
                />
                Live
              </span>
              <span className="font-mono text-[13px] font-medium text-ink-3">
                streaming from postgres · sorted by MRR
              </span>
              <span className="relative ml-auto h-[31px] min-w-80">
                <AnimatePresence initial={false}>
                  {change !== undefined && (
                    <motion.span
                      key={change.seq}
                      className="absolute right-0 rounded-lg px-2.5 py-1.5 font-mono text-[13px] font-medium whitespace-pre"
                      style={{ color: rising ? up : down }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor:
                          tick < 6 ? (rising ? hex.upSoft : hex.downSoft) : alpha(hex.upSoft, 0),
                      }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                        backgroundColor: { duration: 1 },
                      }}
                    >
                      {`${tracked[change.index]?.name ?? ''}  ${money(change.from)} → ${money(change.to)}`}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
            <div className={cardClass}>
              <TableHead mrr={<span className="text-ink">MRR ↓</span>} growth="Growth" />
              <div className="relative" style={{ height: tracked.length * ROW_HEIGHT }}>
                {tracked.map((item, index) => {
                  const rank = order.indexOf(index)
                  const latest = change?.index === index
                  const flashing = latest && tick < 7
                  const moved = latest && change.moved !== 0 ? change.moved : 0
                  return (
                    <motion.div
                      key={item.name}
                      className={rowClass}
                      style={{ height: ROW_HEIGHT, zIndex: flashing ? 2 : 1 }}
                      initial={false}
                      animate={{ y: rank * ROW_HEIGHT }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    >
                      <AccountCells
                        index={rank + 1}
                        item={item}
                        name={
                          <motion.span
                            className="font-mono text-[11px] font-semibold"
                            style={{ color: moved > 0 ? 'var(--color-up)' : 'var(--color-down)' }}
                            animate={{ opacity: moved === 0 ? 0 : 1 }}
                            transition={{ duration: 0.4 }}
                          >
                            {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : ''}
                          </motion.span>
                        }
                        mrr={
                          <motion.span
                            className="-mr-2 rounded-md px-2 py-1 font-mono text-sm font-medium"
                            animate={{
                              backgroundColor: flashing
                                ? alpha(rising ? hex.up : hex.down, 0.16)
                                : alpha(hex.up, 0),
                              color: flashing ? (rising ? up : down) : hex.ink,
                            }}
                            transition={{ duration: flashing ? 0 : 1.4 }}
                          >
                            {money(feed.mrr[index] ?? item.mrr)}
                          </motion.span>
                        }
                      />
                    </motion.div>
                  )
                })}
              </div>
              <TableFoot>
                <span>{tracked.length} accounts</span>
                <span className="ml-auto">
                  Sum <b className="font-mono text-sm font-semibold text-ink">{money(total)}</b>
                </span>
              </TableFoot>
            </div>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
