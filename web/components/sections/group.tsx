'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { accountAt, growthColor, money, percent, type Account } from '@/lib/accounts'
import { ease, pop } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { cardClass } from '../ui/account-table'
import { Avatar } from '../ui/avatar'
import { HealthBar, PlanTag } from '../ui/cells'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

const ROW = 44

const flat = [1, 3, 4, 5, 6, 7, 8, 12].map(accountAt)

interface Group {
  readonly owner: string
  readonly members: readonly Account[]
  readonly sum: number
  readonly average: number
  readonly slot: number
}

const groups: readonly Group[] = (() => {
  const owners = [...new Set(flat.map((item) => item.owner))]
  const built = owners.map((owner) => {
    const members = flat.filter((item) => item.owner === owner)
    const sum = members.reduce((total, item) => total + item.mrr, 0)
    const average = members.reduce((total, item) => total + item.growth, 0) / members.length
    return { owner, members, sum, average }
  })
  let slot = 0
  return built
    .toSorted((a, b) => b.sum - a.sum)
    .map((group) => {
      const placed = { ...group, slot }
      slot += group.members.length + 1
      return placed
    })
})()

const groupedSlot = new Map(
  groups.flatMap((group) =>
    group.members.map((item, index) => [item.name, group.slot + 1 + index]),
  ),
)

const groupedRows = groups.reduce((total, group) => total + group.members.length + 1, 0)

export function GroupBy(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 90, settled: 40 })
  const grouped = tick >= 16 && tick < 76

  return (
    <Section label="Group by">
      <SectionHeader
        index="10"
        label="Group by"
        tone="var(--color-accent)"
        title="Group by any column."
        subtitle="Sums and averages for every group."
      />
      <Reveal>
        <FitStage width={1000}>
          <div ref={stage} className="flex flex-col gap-3.5">
            <div className="flex h-9 items-center gap-2.5">
              <span className="text-sm font-medium text-ink-3">Accounts</span>
              <AnimatePresence>
                {tick >= 10 && tick < 76 && (
                  <motion.span
                    key="chip"
                    initial={{ opacity: 0, scale: 0.6, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    transition={pop}
                    className="inline-flex h-8 items-center gap-[7px] rounded-lg bg-[oklch(0.955_0.03_268)] px-3 text-sm font-medium shadow-[inset_0_0_0_1px_oklch(0.85_0.07_268)]"
                  >
                    <span className="text-ink-2">Group by</span>
                    <b className="font-semibold text-[oklch(0.47_0.18_268)]">Owner</b>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className={cardClass}>
              <div className="flex h-[42px] items-center border-b border-line bg-surface text-[13px] font-medium text-ink-2">
                <div className="w-[290px] flex-none pl-5">Account</div>
                <div className="w-50 flex-none">Owner</div>
                <div className="w-[130px] flex-none">Plan</div>
                <div className="w-[130px] flex-none text-right">MRR</div>
                <div className="w-30 flex-none text-right">Growth</div>
                <div className="w-[130px] flex-none pl-[30px]">Health</div>
              </div>
              <motion.div
                className="relative"
                initial={false}
                animate={{ height: (grouped ? groupedRows : flat.length) * ROW }}
                transition={{ duration: 0.7, ease }}
              >
                {groups.map((group, index) => {
                  const lead = group.members[0]
                  const delay = grouped ? 0.35 + index * 0.08 : 0
                  return (
                    <motion.div
                      key={group.owner}
                      className="absolute inset-x-0 top-0 z-2 flex items-center border-b border-line bg-canvas text-sm"
                      style={{ height: ROW, y: group.slot * ROW }}
                      initial={false}
                      animate={{ opacity: grouped ? 1 : 0, x: grouped ? 0 : -16 }}
                      transition={{
                        opacity: { duration: 0.4, delay },
                        x: { type: 'spring', stiffness: 400, damping: 22, delay },
                      }}
                    >
                      <div className="flex w-[490px] flex-none items-center gap-2.5 pl-5">
                        <span className="size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink-2" />
                        {lead !== undefined && <Avatar person={lead.person} size={24} />}
                        <b className="font-semibold">{group.owner}</b>
                        <span className="h-5 rounded-full bg-[oklch(0.93_0.006_265)] px-[7px] font-mono text-[11.5px] leading-5 font-semibold text-ink-2">
                          {group.members.length}
                        </span>
                      </div>
                      <div className="w-[130px] flex-none" />
                      <div className="w-[130px] flex-none text-right font-mono font-semibold">
                        <span className="mr-1.5 font-sans text-xs font-normal text-ink-3">Sum</span>
                        {money(group.sum)}
                      </div>
                      <div className="w-30 flex-none text-right font-mono font-semibold">
                        <span className="mr-1.5 font-sans text-xs font-normal text-ink-3">Avg</span>
                        <span style={{ color: growthColor(group.average) }}>
                          {percent(group.average)}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
                {flat.map((item, index) => (
                  <motion.div
                    key={item.name}
                    className="absolute inset-x-0 top-0 flex items-center border-b border-line-soft bg-white text-sm"
                    style={{ height: ROW }}
                    initial={false}
                    animate={{ y: (grouped ? (groupedSlot.get(item.name) ?? index) : index) * ROW }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 24,
                      delay: index * 0.03,
                    }}
                  >
                    <motion.div
                      className="w-[290px] flex-none font-[550]"
                      initial={false}
                      animate={{ paddingLeft: grouped ? 54 : 20 }}
                      transition={{ duration: 0.6, ease }}
                    >
                      {item.name}
                    </motion.div>
                    <div className="flex w-50 flex-none items-center gap-[9px]">
                      <Avatar person={item.person} size={24} />
                      {item.owner}
                    </div>
                    <div className="w-[130px] flex-none">
                      <PlanTag plan={item.plan} />
                    </div>
                    <div className="w-[130px] flex-none text-right font-mono font-medium">
                      {money(item.mrr)}
                    </div>
                    <div
                      className="w-30 flex-none text-right font-mono font-medium"
                      style={{ color: growthColor(item.growth) }}
                    >
                      {percent(item.growth)}
                    </div>
                    <div className="flex w-[130px] flex-none items-center gap-2.5 pl-[30px]">
                      <HealthBar health={item.health} />
                      <span className="font-mono text-[12.5px] font-medium text-ink-2">
                        {item.health}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </FitStage>
      </Reveal>
    </Section>
  )
}
