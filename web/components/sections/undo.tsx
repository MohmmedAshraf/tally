'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { accountAt, money } from '@/lib/accounts'
import { alpha, hex } from '@/lib/colors'
import { ease, pop } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { Keycap } from '../keycap'
import { cardClass } from '../ui/account-table'
import { PlanTag, StatusDot } from '../ui/cells'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const rows = [1, 7, 9, 10, 12].map(accountAt)
const ROW = 46

function between(tick: number, from: number, to: number): boolean {
  return tick >= from && tick < to
}

export function Undo(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 72, settled: 30 })
  const pasted = between(tick, 25, 41)
  const flash = between(tick, 25, 31) || between(tick, 41, 47)
  const copyKey = between(tick, 8, 12)
  const pasteKey = between(tick, 24, 28)
  const undoKey = between(tick, 40, 44)
  const range = between(tick, 16, 52)
  const toastOn = between(tick, 9, 15) || between(tick, 25, 31) || between(tick, 41, 47)
  const toast = tick >= 41 ? 'Undid Paste 3 cells' : tick >= 25 ? 'Pasted 3 cells' : 'Copied 1 cell'
  const undone = tick >= 41

  return (
    <Section label="Labeled undo">
      <SectionHeader
        index="09"
        label="Labeled undo"
        tone="var(--color-accent)"
        title="Copy, paste, undo."
        subtitle="Every edit is one entry in the history."
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-center gap-12">
        <Reveal className="grid grid-cols-[repeat(2,minmax(0,170px))] content-center justify-center gap-x-2.5 gap-y-1.5">
          <Keycap glyph="⌘" label="Command" pressed={copyKey || pasteKey || undoKey} />
          <Keycap glyph="C" label="Copy" pressed={copyKey} />
          <Keycap glyph="V" label="Paste" pressed={pasteKey} />
          <Keycap glyph="Z" label="Undo" pressed={undoKey} />
        </Reveal>
        <Reveal delay={80}>
          <FitStage width={600}>
            <div ref={stage} className="flex flex-col gap-3.5">
              <div className={cardClass}>
                <div className="flex h-10 items-center border-b border-line bg-surface text-[13px] font-medium text-ink-2">
                  <div className="w-55 flex-none pl-[18px]">Account</div>
                  <div className="w-[150px] flex-none pl-3">Plan</div>
                  <div className="w-30 flex-none">Status</div>
                  <div className="w-[110px] flex-none pr-[18px] text-right">MRR</div>
                </div>
                <div className="relative">
                  {rows.map((row, index) => {
                    const changed = index >= 1 && index <= 3
                    return (
                      <div
                        key={row.name}
                        className="flex h-[46px] items-center border-b border-line-soft text-sm"
                      >
                        <div className="w-55 flex-none pl-[18px] font-[550]">{row.name}</div>
                        <motion.div
                          className="flex h-[46px] w-[150px] flex-none items-center px-3"
                          initial={false}
                          animate={{
                            backgroundColor:
                              flash && changed ? alpha(hex.accent, 0.1) : alpha(hex.accent, 0),
                          }}
                          transition={{ duration: flash ? 0 : 1 }}
                        >
                          <PlanTag plan={pasted && changed ? 'Enterprise' : row.plan} />
                        </motion.div>
                        <div className="flex w-30 flex-none items-center gap-2">
                          <StatusDot status={row.status} />
                          {row.status}
                        </div>
                        <div className="w-[110px] flex-none pr-[18px] text-right font-mono text-sm font-medium">
                          {money(row.mrr)}
                        </div>
                      </div>
                    )
                  })}
                  <motion.div
                    className="pointer-events-none absolute top-1 left-[224px] h-[38px] w-[142px] rounded-md border-[1.5px] border-dashed border-accent"
                    initial={false}
                    animate={{ opacity: between(tick, 9, 40) ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.div
                    className="pointer-events-none absolute top-0 left-[222px] w-[146px] rounded-[7px] shadow-[0_0_0_2px_var(--color-accent),0_0_0_6px_color-mix(in_oklch,var(--color-accent)_15%,transparent)]"
                    initial={false}
                    animate={{
                      y: (range ? 1 : 0) * ROW + 2,
                      height: (range ? 3 : 1) * ROW - 4,
                      backgroundColor: range ? alpha(hex.accent, 0.05) : alpha(hex.accent, 0),
                    }}
                    transition={{ duration: 0.55, ease }}
                  />
                  <AnimatePresence>
                    {toastOn && (
                      <motion.div
                        key={toast}
                        className="absolute right-4 bottom-3 h-[30px] rounded-lg bg-ink px-3 text-[13px] leading-[30px] font-medium text-white"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={pop}
                      >
                        {toast}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-[18px] py-3.5">
                <div className="pb-1.5 font-mono text-xs font-medium tracking-[0.04em] text-ink-3 uppercase">
                  History
                </div>
                <AnimatePresence initial={false}>
                  {tick >= 25 && (
                    <motion.div
                      key="paste"
                      className="flex items-center gap-2.5 overflow-hidden text-sm font-medium"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 30, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease }}
                    >
                      <span
                        className={`size-2 flex-none rounded-full ${undone ? 'bg-grey' : 'bg-accent'}`}
                      />
                      <span className={undone ? 'text-ink-3 line-through' : 'text-ink'}>
                        Paste 3 cells · Plan
                      </span>
                      <span className="ml-auto font-mono text-xs font-medium text-ink-3">
                        {undone ? 'undone' : '⌘V'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {[
                  { label: 'Edit MRR · Quill & Co', meta: '2m ago' },
                  { label: 'Sort by MRR', meta: '5m ago' },
                ].map((entry) => (
                  <div
                    key={entry.label}
                    className="flex h-[30px] items-center gap-2.5 text-sm font-medium"
                  >
                    <span className="size-2 flex-none rounded-full bg-ink-3" />
                    <span>{entry.label}</span>
                    <span className="ml-auto font-mono text-xs font-medium text-ink-3">
                      {entry.meta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FitStage>
        </Reveal>
      </div>
    </Section>
  )
}
