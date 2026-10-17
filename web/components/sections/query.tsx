'use client'

import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { accounts, money, type Account } from '@/lib/accounts'
import { ease, pop } from '@/lib/motion'
import { hex } from '@/lib/colors'
import { useTicks } from '@/lib/use-ticks'
import {
  AccountCells,
  cardClass,
  ROW_HEIGHT,
  rowClass,
  TableFoot,
  TableHead,
} from '../ui/account-table'
import { Caret } from '../ui/caret'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const fallIn = [0.55, 0, 1, 0.45] as const

const overFive = (item: Account): boolean => item.mrr > 5000
const growing = (item: Account): boolean => overFive(item) && item.growth > 0

const kept = accounts.filter(growing)
const swiped = accounts.filter((item) => overFive(item) && !growing(item))

function noise(seed: number): number {
  const value = Math.sin(seed * 91.7 + 17.3) * 43758.5453
  return value - Math.floor(value)
}

function rowMotion(item: Account, index: number, tick: number): TargetAndTransition {
  const rest = { x: 0, y: index * ROW_HEIGHT, rotate: 0, opacity: 1 }
  if (tick >= 104) return { ...rest, opacity: 0, transition: { duration: 0 } }
  const fade: Transition = { duration: 0.35 }
  const out = tick >= 100
  if (tick >= 20 && !overFive(item)) {
    const delay = (index - 9) * 0.07
    return {
      x: (noise(index) - 0.5) * 180,
      y: index * ROW_HEIGHT + 560,
      rotate: (noise(index + 3) - 0.5) * 30,
      opacity: 0,
      transition: {
        default: { duration: 0.95, ease: fallIn, delay },
        opacity: { duration: 0.35, delay: delay + 0.55 },
      },
    }
  }
  if (tick >= 48 && !growing(item)) {
    const delay = swiped.indexOf(item) * 0.09
    return {
      x: 1250,
      y: index * ROW_HEIGHT,
      rotate: 2,
      opacity: 0,
      transition: {
        default: { duration: 0.75, ease: fallIn, delay },
        opacity: { duration: 0.3, delay: delay + 0.45 },
      },
    }
  }
  if (tick >= 56 && growing(item)) {
    const slot = kept.indexOf(item)
    return {
      ...rest,
      y: slot * ROW_HEIGHT,
      opacity: out ? 0 : 1,
      transition: out ? fade : { type: 'spring', stiffness: 260, damping: 24, delay: slot * 0.05 },
    }
  }
  return { ...rest, opacity: out ? 0 : 1, transition: fade }
}

function Clause({ column, value }: { readonly column: string; readonly value: string }): ReactNode {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={pop}
      className="inline-flex h-8 items-center gap-[7px] rounded-lg bg-[oklch(0.955_0.03_268)] px-3 font-mono text-[15px] font-medium shadow-[inset_0_0_0_1px_oklch(0.85_0.07_268)]"
    >
      <b className="font-semibold">{column}</b>
      <span className="text-ink-3">&gt;</span>
      <span className="text-accent">{value}</span>
    </motion.span>
  )
}

function Lit({ on, children }: { readonly on: boolean; readonly children: ReactNode }): ReactNode {
  return (
    <motion.span
      animate={{ color: on ? hex.accent : hex.ink2 }}
      transition={{ duration: 0.3 }}
      className={on ? 'font-semibold' : undefined}
    >
      {children}
    </motion.span>
  )
}

export function Query(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 110, settled: 70 })
  const live = tick < 100
  const narrowed = tick >= 56 && tick < 104
  const filtered = tick >= 21 && live
  const count = narrowed ? kept.length : filtered ? accounts.filter(overFive).length : 14
  const sum = (narrowed ? kept : filtered ? accounts.filter(overFive) : accounts).reduce(
    (total, item) => total + item.mrr,
    0,
  )

  return (
    <Section label="Query language">
      <SectionHeader
        index="02"
        label="Query language"
        tone="var(--color-accent)"
        title="One query language for filter, sort and group."
        subtitle="Type it, and the rows answer."
      />
      <Reveal>
        <FitStage width={1120}>
          <div ref={stage} className="flex flex-col gap-4">
            <div className="flex h-15 items-center gap-3 rounded-2xl border border-line bg-white px-5 shadow-[0_10px_30px_-18px_oklch(0.3_0.04_268/.25)]">
              <span className="size-4 flex-none rounded-full border-2 border-ink-3" />
              {(tick < 8 || tick >= 100) && (
                <span className="text-base text-ink-3">
                  Filter or ask — plan is pro and mrr &gt; 5k
                </span>
              )}
              {tick >= 8 && tick < 17 && (
                <>
                  <span className="font-mono text-base font-medium">
                    {'mrr > 5k'.slice(0, tick - 8)}
                  </span>
                  <Caret color="var(--color-accent)" />
                </>
              )}
              <AnimatePresence>
                {tick >= 17 && live && <Clause key="mrr" column="mrr" value="5k" />}
                {tick >= 33 && live && (
                  <motion.span
                    key="and"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[15px] text-ink-3"
                  >
                    and
                  </motion.span>
                )}
              </AnimatePresence>
              {tick >= 34 && tick < 45 && (
                <>
                  <span className="font-mono text-base font-medium">
                    {'growth > 0'.slice(0, tick - 34)}
                  </span>
                  <Caret color="var(--color-accent)" />
                </>
              )}
              <AnimatePresence>
                {tick >= 45 && live && <Clause key="growth" column="growth" value="0" />}
              </AnimatePresence>
              <span className="ml-auto font-mono text-[12.5px] font-medium text-ink-3">
                ⏎ to apply
              </span>
            </div>
            <div className={cardClass}>
              <TableHead
                mrr={<Lit on={tick >= 17 && live}>MRR</Lit>}
                growth={<Lit on={tick >= 45 && live}>Growth</Lit>}
              />
              <motion.div
                className="relative overflow-hidden"
                initial={false}
                animate={{ height: (narrowed ? kept.length : 14) * ROW_HEIGHT }}
                transition={tick >= 104 ? { duration: 0 } : { duration: 0.7, ease }}
              >
                {accounts.map((item, index) => (
                  <motion.div
                    key={item.name}
                    className={rowClass}
                    style={{ height: ROW_HEIGHT, zIndex: tick >= 20 && !growing(item) ? 3 : 1 }}
                    initial={false}
                    animate={rowMotion(item, index, tick)}
                  >
                    <AccountCells
                      index={index + 1}
                      item={item}
                      mrr={<span className="font-mono text-sm font-medium">{money(item.mrr)}</span>}
                    />
                  </motion.div>
                ))}
                <motion.div
                  className="pointer-events-none absolute right-0 left-11 z-5 h-0.5 bg-accent shadow-[0_0_12px_var(--color-accent)]"
                  initial={false}
                  animate={{
                    y: tick >= 18 ? 9 * ROW_HEIGHT : 0,
                    opacity: tick >= 17 && tick < 25 ? 1 : 0,
                  }}
                  transition={{
                    y: { type: 'spring', stiffness: 120, damping: 14 },
                    opacity: { duration: 0.3 },
                  }}
                >
                  <span className="absolute -top-[26px] left-2 h-[22px] rounded-md bg-accent px-2 font-mono text-xs leading-[22px] font-semibold text-white">
                    mrr &gt; 5k
                  </span>
                </motion.div>
                <motion.div
                  className="pointer-events-none absolute top-0 left-[814px] z-4 w-25 rounded-md bg-[color-mix(in_oklch,var(--color-accent)_7%,transparent)] shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--color-accent)_45%,transparent)]"
                  style={{ height: 9 * ROW_HEIGHT }}
                  initial={false}
                  animate={{ opacity: tick >= 45 && tick < 55 ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
              <TableFoot>
                <span>
                  <b className="font-mono text-sm font-semibold text-ink">{count}</b> accounts
                </span>
                <span className="ml-auto">
                  Sum <b className="font-mono text-sm font-semibold text-ink">{money(sum)}</b>
                </span>
              </TableFoot>
            </div>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
