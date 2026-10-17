'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { accounts, money } from '@/lib/accounts'
import { hex } from '@/lib/colors'
import { ease, spring } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { Avatar } from '../ui/avatar'
import { StatusDot } from '../ui/cells'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const rows = accounts.slice(0, 8)
const cards = rows.slice(0, 5)

const sheet = [
  { label: 'Owner', value: 'Kenji Sato' },
  { label: 'Plan', value: 'Enterprise' },
  { label: 'MRR', value: '$26,480' },
  { label: 'Growth', value: '+21.1%' },
]

function Collapsing({
  hidden,
  grow,
  className,
  children,
}: {
  readonly hidden: boolean
  readonly grow: number
  readonly className?: string
  readonly children: ReactNode
}): ReactNode {
  return (
    <motion.div
      className={`min-w-0 basis-0 overflow-hidden ${className ?? ''}`}
      initial={false}
      animate={{ flexGrow: hidden ? 0.001 : grow, opacity: hidden ? 0 : 1 }}
      transition={{ flexGrow: { duration: 0.6, ease }, opacity: { duration: 0.3 } }}
    >
      {children}
    </motion.div>
  )
}

export function Mobile(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 92, settled: 50 })
  const narrow = tick >= 16 && tick < 76
  const showCards = tick >= 27 && tick < 74
  const sheetOpen = tick >= 44 && tick < 64
  const noOwner = tick >= 19 && tick < 76
  const noStatus = tick >= 23 && tick < 76

  return (
    <Section label="Mobile">
      <SectionHeader
        index="11"
        label="Mobile"
        tone="var(--color-accent)"
        title="Tables that work on a phone."
        subtitle="Rows become cards, details open in a sheet."
      />
      <Reveal delay={80}>
        <FitStage width={620}>
          <div ref={stage} className="flex h-140 items-center justify-center">
            <motion.div
              className="relative flex-none overflow-hidden border-solid bg-white shadow-[0_40px_80px_-30px_oklch(0.3_0.04_268/.35)]"
              initial={false}
              animate={{
                width: narrow ? 300 : 600,
                height: narrow ? 540 : 440,
                borderRadius: narrow ? 38 : 14,
                borderWidth: narrow ? 9 : 1,
                borderColor: narrow ? hex.ink : hex.line,
              }}
              transition={{ duration: 1.1, ease }}
            >
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: showCards ? 0 : 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex h-10 items-center gap-1.5 border-b border-line bg-surface px-4">
                  <span className="size-[9px] rounded-full bg-[oklch(0.88_0.006_265)]" />
                  <span className="size-[9px] rounded-full bg-[oklch(0.88_0.006_265)]" />
                  <span className="size-[9px] rounded-full bg-[oklch(0.88_0.006_265)]" />
                </div>
                <div className="flex h-10 items-center gap-2.5 border-b border-line px-4 text-[12.5px] font-medium text-ink-2">
                  <div className="min-w-0 flex-[1.5]">Account</div>
                  <Collapsing hidden={noOwner} grow={1.3}>
                    Owner
                  </Collapsing>
                  <Collapsing hidden={noStatus} grow={1}>
                    Status
                  </Collapsing>
                  <div className="min-w-0 flex-1 text-right">MRR</div>
                </div>
                {rows.map((row) => (
                  <div
                    key={row.name}
                    className="flex h-12 items-center gap-2.5 border-b border-line-soft px-4 text-[13.5px]"
                  >
                    <div className="min-w-0 flex-[1.5] truncate font-[550]">{row.name}</div>
                    <Collapsing hidden={noOwner} grow={1.3} className="flex items-center gap-2">
                      <Avatar person={row.person} size={22} />
                      <span className="truncate">{row.owner}</span>
                    </Collapsing>
                    <Collapsing hidden={noStatus} grow={1} className="flex items-center gap-[7px]">
                      <StatusDot status={row.status} />
                      <span className="whitespace-nowrap">{row.status}</span>
                    </Collapsing>
                    <div className="min-w-0 flex-1 text-right font-mono text-[13px] font-medium">
                      {money(row.mrr)}
                    </div>
                  </div>
                ))}
              </motion.div>
              <motion.div
                className="absolute inset-0 flex flex-col gap-2.5 bg-canvas px-3 py-1"
                initial={false}
                animate={{ opacity: showCards ? 1 : 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-baseline justify-between px-1 pt-[22px] pb-3">
                  <b className="text-[22px] font-bold tracking-[-0.02em]">Accounts</b>
                  <span className="font-mono text-xs font-medium text-ink-3">240</span>
                </div>
                {cards.map((row, index) => (
                  <motion.div
                    key={row.name}
                    className="flex flex-col gap-2 rounded-[14px] bg-white px-3.5 py-3 shadow-[0_0_0_1px_var(--color-line)]"
                    initial={false}
                    animate={{ opacity: showCards ? 1 : 0, y: showCards ? 0 : 14 }}
                    transition={{ ...spring, delay: index * 0.06 }}
                  >
                    <div className="flex items-center justify-between">
                      <b className="text-[15px] font-semibold">{row.name}</b>
                      <span className="font-mono text-sm font-semibold">{money(row.mrr)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-ink-2">
                      <StatusDot status={row.status} />
                      {row.status}
                      <span className="ml-auto flex items-center gap-1.5">
                        <Avatar person={row.person} size={20} />
                        {row.owner}
                      </span>
                    </div>
                  </motion.div>
                ))}
                <AnimatePresence>
                  {tick >= 40 && tick < 45 && (
                    <motion.div
                      key="tap"
                      className="pointer-events-none absolute top-[84px] left-[118px] size-11 rounded-full bg-[oklch(0.53_0.2_268/.25)] shadow-[0_0_0_2px_oklch(0.53_0.2_268/.5)]"
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 1, scale: tick >= 41 ? 0.75 : 1.2 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
              <motion.div
                className="absolute inset-x-0 bottom-0 z-5 h-[72%] rounded-t-[22px] bg-white px-[18px] py-3 shadow-[0_-20px_40px_-10px_oklch(0.2_0.02_268/.25)]"
                initial={false}
                animate={{ y: sheetOpen ? '0%' : '105%' }}
                transition={
                  sheetOpen
                    ? { type: 'spring', stiffness: 260, damping: 26 }
                    : { duration: 0.6, ease }
                }
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-xs bg-[oklch(0.85_0.008_265)]" />
                <div className="mb-3.5 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-[10px] bg-[oklch(0.95_0.04_45)] text-sm font-bold text-[oklch(0.45_0.12_45)]">
                    AF
                  </span>
                  <div className="flex flex-col gap-[3px]">
                    <b className="text-lg font-bold">Atlas Freight</b>
                    <span className="text-[12.5px] text-ink-3">atlasfreight.com</span>
                  </div>
                </div>
                {sheet.map((field) => (
                  <div
                    key={field.label}
                    className="flex h-10 items-center justify-between border-t border-line-soft text-sm"
                  >
                    <span className="text-ink-3">{field.label}</span>
                    {field.label === 'Owner' ? (
                      <span className="flex items-center gap-[7px]">
                        <Avatar person="kenji" size={20} />
                        {field.value}
                      </span>
                    ) : field.label === 'Plan' ? (
                      <span>{field.value}</span>
                    ) : (
                      <span
                        className={`font-mono font-semibold ${field.label === 'Growth' ? 'text-up' : ''}`}
                      >
                        {field.value}
                      </span>
                    )}
                  </div>
                ))}
                <div className="flex h-10 items-center justify-between border-t border-line-soft text-sm">
                  <span className="text-ink-3">Renews</span>
                  <span>
                    Oct 13 · <span className="text-warn-ink">today</span>
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
