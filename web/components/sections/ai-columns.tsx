'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { accountAt, money } from '@/lib/accounts'
import { ease, pop } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { Avatar } from '../ui/avatar'
import { Shimmer } from '../ui/caret'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const answers = [
  'Software',
  'Healthcare',
  'Logistics',
  'Banking',
  'Robotics',
  'Cloud infrastructure',
  'Data & analytics',
]

const rows = [1, 7, 0, 12, 13, 2, 10].map((index, order) => ({
  ...accountAt(index),
  answer: answers[order] ?? '',
}))

const headClass =
  'flex h-[58px] items-center border-b border-line bg-surface text-[13px] font-medium text-ink-2'
const cellClass = 'flex h-12 items-center border-b border-line-soft text-sm'

export function AiColumns(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 92, settled: 60 })
  const open = tick >= 6 && tick < 84

  return (
    <Section label="AI columns">
      <SectionHeader
        index="03"
        label="tally-ai · AI columns"
        tone="var(--color-ai)"
        title="AI columns."
        subtitle="Your model fills every cell, batch by batch."
      />
      <Reveal>
        <FitStage width={1000}>
          <div
            ref={stage}
            className="flex overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_60px_-30px_oklch(0.4_0.1_300/.25)]"
          >
            <div className="w-60 flex-none">
              <div className={`${headClass} pl-5`}>Account</div>
              {rows.map((row) => (
                <div key={row.name} className={`${cellClass} pl-5 font-[550]`}>
                  {row.name}
                </div>
              ))}
            </div>
            <div className="w-50 flex-none">
              <div className={headClass}>Owner</div>
              {rows.map((row) => (
                <div key={row.name} className={`${cellClass} gap-[9px]`}>
                  <Avatar person={row.person} size={24} />
                  {row.owner}
                </div>
              ))}
            </div>
            <div className="w-[130px] flex-none">
              <div className={`${headClass} justify-end pr-6`}>MRR</div>
              {rows.map((row) => (
                <div
                  key={row.name}
                  className={`${cellClass} justify-end pr-6 font-mono font-medium`}
                >
                  {money(row.mrr)}
                </div>
              ))}
            </div>
            <motion.div
              className="flex-none overflow-hidden border-[oklch(0.88_0.06_300)]"
              initial={false}
              animate={{ width: open ? 330 : 0, borderLeftWidth: open ? 1 : 0 }}
              transition={{ duration: 0.8, ease }}
            >
              <div className="w-[330px]">
                <div className="flex h-[58px] flex-col justify-center gap-1 border-b border-[oklch(0.88_0.06_300)] bg-[oklch(0.975_0.015_300)] px-[18px]">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ai-ink">
                    <span className="size-2 rotate-45 rounded-[1px] bg-ai" />
                    Industry
                  </span>
                  <span className="font-mono text-xs text-[oklch(0.6_0.08_300)]">
                    &quot;Which industry is this company in?&quot;
                  </span>
                </div>
                {rows.map((row, index) => {
                  const done = open && tick >= 18 + index * 4
                  const pending = open && tick >= 10 && !done
                  return (
                    <div
                      key={row.name}
                      className="flex h-12 items-center border-b border-line-soft bg-[oklch(0.99_0.006_300)] px-[18px]"
                    >
                      <AnimatePresence mode="popLayout">
                        {pending && (
                          <motion.span
                            key="pending"
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          >
                            <Shimmer
                              duration={1.2}
                              className="block h-2.5 w-[150px] rounded-[5px]"
                              style={{
                                backgroundImage:
                                  'linear-gradient(90deg, oklch(0.93 0.03 300) 25%, oklch(0.85 0.09 300) 50%, oklch(0.93 0.03 300) 75%)',
                              }}
                            />
                          </motion.span>
                        )}
                        {done && (
                          <motion.span
                            key="done"
                            initial={{ opacity: 0, scale: 0.6, y: 6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={pop}
                            className="inline-flex h-7 items-center rounded-[7px] bg-[oklch(0.955_0.03_300)] px-[11px] text-[13.5px] font-[550] text-[oklch(0.45_0.17_300)]"
                          >
                            {row.answer}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </motion.div>
            <div className="min-w-0 flex-1 border-l border-line-soft">
              <div className="flex h-[58px] items-center justify-center border-b border-line bg-surface text-lg font-medium text-ink-3">
                +
              </div>
            </div>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
