'use client'

import { motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { accounts, money } from '@/lib/accounts'
import { ease } from '@/lib/motion'
import { useTicks } from '@/lib/use-ticks'
import { BrandIcon, type Brand } from '../brand-icon'
import { Avatar } from '../ui/avatar'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { Section, SectionHeader } from '../ui/section-header'

interface Theme {
  readonly name: string
  readonly stack: readonly Brand[]
  readonly bg: string
  readonly ink: string
  readonly ink2: string
  readonly line: string
  readonly accent: string
  readonly badgeBg: string
  readonly stage: string
  readonly radius: number
  readonly badge: number
  readonly font: string
  readonly numbers: string
  readonly weight: number
}

const sans = 'var(--font-onest), system-ui, sans-serif'
const mono = 'var(--font-jetbrains-mono), ui-monospace, monospace'
const serif = "Georgia, 'Times New Roman', serif"

const themes = [
  {
    name: 'Tally',
    stack: ['react', 'postgres'],
    bg: '#ffffff',
    ink: '#16181e',
    ink2: '#83868d',
    line: '#eaebee',
    accent: '#008580',
    badgeBg: '#dbeeed',
    stage: '#f5f7fa',
    radius: 18,
    badge: 7,
    font: sans,
    numbers: mono,
    weight: 560,
  },
  {
    name: 'Midnight',
    stack: ['vue', 'laravel'],
    bg: '#13151f',
    ink: '#eceef5',
    ink2: '#8c91a5',
    line: '#282a38',
    accent: '#a490ff',
    badgeBg: '#27263e',
    stage: '#070811',
    radius: 12,
    badge: 99,
    font: sans,
    numbers: mono,
    weight: 500,
  },
  {
    name: 'Paper',
    stack: ['svelte', 'supabase'],
    bg: '#fcf5ea',
    ink: '#332219',
    ink2: '#776559',
    line: '#e4d9cd',
    accent: '#be512d',
    badgeBg: '#f3ded0',
    stage: '#efe7d9',
    radius: 3,
    badge: 0,
    font: serif,
    numbers: serif,
    weight: 600,
  },
  {
    name: 'Bubble',
    stack: ['solid'],
    bg: '#f4fbff',
    ink: '#132341',
    ink2: '#61728f',
    line: '#dfe9f5',
    accent: '#167afa',
    badgeBg: '#d5e9fe',
    stage: '#ddedff',
    radius: 32,
    badge: 99,
    font: sans,
    numbers: sans,
    weight: 700,
  },
] as const satisfies readonly Theme[]

const rows = accounts.slice(0, 5)
const flip = { duration: 0.6, ease }

export function Theming(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 128, settled: 0 })
  const [picked, setPicked] = useState<number>()
  const active = picked ?? Math.floor(tick / 32) % themes.length
  const theme: Theme = themes[active] ?? themes[0]

  return (
    <Section label="Theming">
      <SectionHeader
        index="12"
        label="Theming"
        tone="var(--color-accent)"
        title="Make it look like your product."
        subtitle="Colors, radius and type are all tokens."
      />
      <Reveal className="flex flex-col items-center gap-7">
        <div
          role="group"
          aria-label="Themes"
          className="flex flex-wrap justify-center gap-2 rounded-2xl border border-line bg-white p-1.5"
        >
          {themes.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === active}
              onClick={() => setPicked(index)}
              className={`relative flex h-10 cursor-pointer items-center gap-2.5 rounded-[11px] px-3.5 text-sm font-semibold transition-colors duration-300 ${index === active ? 'text-white' : 'text-ink-2'}`}
            >
              {index === active && (
                <motion.span
                  layoutId="theme-tab"
                  className="absolute inset-0 rounded-[11px] bg-ink"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex gap-1.5">
                {item.stack.map((brand) => (
                  <BrandIcon key={brand} brand={brand} size={18} />
                ))}
              </span>
              <span className="relative">{item.name}</span>
            </button>
          ))}
        </div>
        <div className="w-full">
          <FitStage width={880}>
            <motion.div
              ref={stage}
              className="overflow-hidden"
              style={{ fontFamily: theme.font }}
              initial={false}
              animate={{
                backgroundColor: theme.bg,
                color: theme.ink,
                borderRadius: theme.radius,
                boxShadow: `0 0 0 1px ${theme.line}, 0 40px 80px -36px rgba(37, 45, 66, 0.4), 0 0 0 14px ${theme.stage}`,
              }}
              transition={flip}
            >
              <motion.div
                className="flex h-12 items-center border-b px-[26px] text-[13px] font-medium"
                initial={false}
                animate={{ color: theme.ink2, borderColor: theme.line }}
                transition={flip}
              >
                <div className="flex-[1.4]">Account</div>
                <div className="flex-[1.3]">Owner</div>
                <div className="flex-1">Status</div>
                <div className="flex-1 text-right">MRR</div>
              </motion.div>
              {rows.map((row) => (
                <motion.div
                  key={row.name}
                  className="flex h-15 items-center border-b px-[26px] text-[15px]"
                  initial={false}
                  animate={{ borderColor: theme.line }}
                  transition={flip}
                >
                  <div className="flex-[1.4]" style={{ fontWeight: theme.weight }}>
                    {row.name}
                  </div>
                  <motion.div
                    className="flex flex-[1.3] items-center gap-2.5"
                    initial={false}
                    animate={{ color: theme.ink2 }}
                    transition={flip}
                  >
                    <Avatar person={row.person} size={26} />
                    {row.owner}
                  </motion.div>
                  <div className="flex-1">
                    <motion.span
                      className="inline-flex h-[26px] items-center px-[11px] text-[13px] font-semibold"
                      initial={false}
                      animate={{
                        color: theme.accent,
                        backgroundColor: theme.badgeBg,
                        borderRadius: theme.badge,
                      }}
                      transition={flip}
                    >
                      {row.status}
                    </motion.span>
                  </div>
                  <div
                    className="flex-1 text-right"
                    style={{
                      fontFamily: theme.numbers,
                      fontWeight: theme.weight > 600 ? 700 : 500,
                    }}
                  >
                    {money(row.mrr)}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </FitStage>
        </div>
      </Reveal>
    </Section>
  )
}
