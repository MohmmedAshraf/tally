'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { useTicks } from '@/lib/use-ticks'
import { Avatar } from '../ui/avatar'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

interface Sample {
  readonly type: string
  readonly column: string
  readonly raw: string
  readonly typed: ReactNode
}

const samples: readonly Sample[] = [
  {
    type: 'currency',
    column: 'MRR',
    raw: '24380',
    typed: <span className="font-mono text-[19px] font-semibold">$24,380</span>,
  },
  {
    type: 'person',
    column: 'Owner',
    raw: '"Amara Owusu"',
    typed: (
      <>
        <Avatar person="amara" size={30} />
        <span className="text-base font-medium">Amara Owusu</span>
      </>
    ),
  },
  {
    type: 'enum',
    column: 'Status',
    raw: '"past_due"',
    typed: (
      <>
        <span className="size-2 rounded-full bg-warn shadow-[0_0_0_4px_oklch(0.76_0.15_75/.18)]" />
        <span className="text-base font-medium">Past due</span>
      </>
    ),
  },
  {
    type: 'sparkline',
    column: 'Growth',
    raw: '[3, 5, 4, 7, 6, 9]',
    typed: (
      <>
        <svg width="84" height="26" aria-hidden>
          <polyline
            points="0,22 16,15 32,18 48,9 64,12 84,3"
            fill="none"
            stroke="var(--color-up)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-mono text-[15px] font-semibold text-up">+17.7%</span>
      </>
    ),
  },
  {
    type: 'bar',
    column: 'Health',
    raw: '67',
    typed: (
      <>
        <span className="block h-1.5 w-24 overflow-hidden rounded-[3px] bg-[oklch(0.92_0.004_265)]">
          <span className="block h-1.5 w-[67%] bg-warn" />
        </span>
        <span className="font-mono text-[15px] font-semibold">67</span>
      </>
    ),
  },
  {
    type: 'date',
    column: 'Renewal',
    raw: '"2026-11-17"',
    typed: (
      <>
        <span className="text-base font-medium">Nov 17, 2026</span>
        <span className="text-[13px] font-medium text-warn-ink">in 31 days</span>
      </>
    ),
  },
  {
    type: 'percent',
    column: 'Change',
    raw: '-8.2',
    typed: <span className="font-mono text-[19px] font-semibold text-down">-8.2%</span>,
  },
  {
    type: 'enum',
    column: 'Plan',
    raw: '"enterprise"',
    typed: (
      <span className="rounded-[7px] bg-[oklch(0.95_0.03_268)] px-[11px] py-[5px] text-sm font-semibold text-[oklch(0.47_0.18_268)]">
        Enterprise
      </span>
    ),
  },
]

const face = 'absolute inset-0 flex items-center gap-2.5 px-3.5'

export function ColumnTypes(): ReactNode {
  const grid = useRef<HTMLDivElement>(null)
  const tick = useTicks(grid, { length: 64, settled: 30 })

  return (
    <Section label="Column types">
      <SectionHeader
        index="08"
        label="Column types"
        tone="var(--color-accent)"
        title="Typed columns."
        subtitle="Money, people, status, scores and sparklines."
      />
      <div ref={grid} className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {samples.map((sample, index) => {
          const phase = (tick - index * 2 + 64) % 64
          const typed = phase >= 4 && phase < 48
          return (
            <Reveal key={`${sample.type}-${sample.column}`} delay={(index % 4) * 60}>
              <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-[18px]">
                <div className="flex justify-between font-mono text-xs font-medium text-ink-2">
                  <span>{sample.type}</span>
                  <span className="text-ink-3">{sample.column}</span>
                </div>
                <div className="relative h-12 overflow-hidden rounded-[10px] bg-canvas">
                  <AnimatePresence initial={false}>
                    {typed ? (
                      <motion.div
                        key="typed"
                        className={face}
                        initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(4px)' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      >
                        {sample.typed}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="raw"
                        className={face}
                        initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                        transition={{ duration: 0.5 }}
                      >
                        <span className="font-mono text-[15px] font-medium text-[oklch(0.55_0.012_265)]">
                          {sample.raw}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
