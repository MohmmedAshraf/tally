'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { accountAt, growthColor, money, percent } from '@/lib/accounts'
import { pop } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { Avatar } from '../ui/avatar'
import { Caret, Shimmer } from '../ui/caret'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const prompt = 'growing team accounts over 5k'

const chips = [
  { column: 'plan', op: 'is', value: 'Team' },
  { column: 'MRR', op: '>', value: '$5,000' },
  { column: 'growth', op: '>', value: '0%' },
]

const matches = [4, 6, 7, 8].map(accountAt)

const rise = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.5, ease: 'easeOut' },
} as const

export function Ask(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 100, settled: 60 })
  const typed = Math.min(prompt.length, Math.max(0, Math.floor((tick - 5) * 1.6)))
  const showing = tick < 96
  const empty = tick < 5 || !showing

  return (
    <Section id="features" label="Ask AI">
      <SectionHeader
        index="01"
        label="tally-ai · Ask AI"
        tone="var(--color-ai)"
        title="Ask your data in plain English."
        subtitle="tally-ai returns a real, editable filter."
      />
      <div className="flex justify-center">
        <Reveal delay={80} className="w-full max-w-190">
          <div
            ref={stage}
            className="flex min-h-105 w-full flex-col gap-[18px] rounded-[20px] border border-line bg-white p-4 shadow-[0_30px_60px_-30px_oklch(0.4_0.1_300/.3)] sm:p-[22px]"
          >
            <div className="flex h-14 items-center gap-3 rounded-[14px] bg-[oklch(0.985_0.008_300)] px-4 shadow-[inset_0_0_0_1.5px_oklch(0.85_0.08_300)]">
              <span className="size-[11px] flex-none rotate-45 rounded-[2px] bg-ai" />
              {empty ? (
                <span className="text-base text-ink-3">Ask anything about your accounts</span>
              ) : (
                <span className="truncate text-base font-medium">{prompt.slice(0, typed)}</span>
              )}
              {tick >= 5 && tick < 34 && (
                <Caret color="var(--color-ai)" className="-ml-2.5 h-5 w-0.5" />
              )}
            </div>
            <motion.div
              className="flex flex-col gap-4"
              animate={{ opacity: tick >= 90 ? 0 : 1 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence>
                {tick >= 24 && tick < 33 && (
                  <motion.span
                    key="thinking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Shimmer
                      className="bg-clip-text text-sm font-medium text-transparent"
                      style={{
                        backgroundImage:
                          'linear-gradient(90deg, var(--color-ink-3) 30%, var(--color-ai) 50%, var(--color-ink-3) 70%)',
                      }}
                    >
                      Writing a filter…
                    </Shimmer>
                  </motion.span>
                )}
              </AnimatePresence>
              <div className="flex min-h-[34px] flex-wrap items-center gap-2">
                <AnimatePresence>
                  {chips.map(
                    (chip, index) =>
                      tick >= 33 + index * 3 &&
                      showing && (
                        <motion.span
                          key={chip.column}
                          initial={{ opacity: 0, scale: 0.6, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.2 } }}
                          transition={pop}
                          className="inline-flex h-[34px] items-center gap-[7px] rounded-[9px] bg-chip px-3 text-[14.5px] font-medium shadow-[inset_0_0_0_1px_oklch(0.9_0.006_265)]"
                        >
                          <span className="text-ink-2">{chip.column}</span>
                          <span className="text-ink-3">{chip.op}</span>
                          <b className="font-semibold">{chip.value}</b>
                        </motion.span>
                      ),
                  )}
                </AnimatePresence>
              </div>
              <div className="flex flex-col border-t border-line">
                <AnimatePresence>
                  {matches.map(
                    (item, index) =>
                      tick >= 43 + index * 2 &&
                      showing && (
                        <motion.div
                          key={item.name}
                          {...rise}
                          exit={{ opacity: 0 }}
                          className="grid h-12 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center border-b border-line-soft text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-[9px] font-[550]">
                            <Avatar person={item.person} size={24} />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="text-ink-2">{item.plan}</span>
                          <span className="text-right font-mono text-[13.5px] font-medium">
                            {money(item.mrr)}
                          </span>
                          <span
                            className="text-right font-mono text-[13.5px] font-medium"
                            style={{ color: growthColor(item.growth) }}
                          >
                            {percent(item.growth)}
                          </span>
                        </motion.div>
                      ),
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {tick >= 52 && showing && (
                  <motion.div
                    key="done"
                    {...rise}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 text-[13.5px] text-ink-3"
                  >
                    <span>
                      <b className="font-mono text-sm font-semibold text-ink">4</b> of 240 accounts
                    </span>
                    <span className="ml-auto flex h-8 items-center rounded-lg bg-ink px-3 text-[13px] font-semibold text-white">
                      Save as view
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
