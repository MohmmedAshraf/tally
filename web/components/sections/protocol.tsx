'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { useTicks } from '@/lib/use-ticks'
import { ExpandSection } from '../ui/expand-section'
import { FitStage } from '../ui/fit-stage'
import { Reveal } from '../ui/reveal'
import { SectionHeader } from '../ui/section-header'

const tone = {
  text: 'oklch(0.9 0.006 265)',
  dim: 'oklch(0.55 0.012 265)',
  str: 'oklch(0.8 0.1 190)',
  num: 'oklch(0.84 0.12 80)',
  keyword: 'oklch(0.74 0.15 268)',
  type: 'oklch(0.78 0.13 300)',
}

const keywords = /^(select|from|where|and|order|by|desc|limit|GET)$/

function tokens(line: string): { text: string; color: string; at: number }[] {
  let at = 0
  return (line.match(/('[^']*'|"[^"]*"|\d+|[A-Za-z_$][\w$]*|\s+|.)/g) ?? []).map((text) => {
    const start = at
    at += text.length
    let color = tone.text
    if (/^['"]/.test(text)) color = tone.str
    else if (/^\d/.test(text)) color = tone.num
    else if (keywords.test(text)) color = tone.keyword
    else if (/^[^\w\s]+$/.test(text)) color = tone.dim
    return { text, color, at: start }
  })
}

function Code({ line }: { readonly line: string }): ReactNode {
  return tokens(line).map((token) => (
    <span key={token.at} style={{ color: token.color }}>
      {token.text}
    </span>
  ))
}

const request = [
  '{',
  '  "version": 1,',
  '  "filter": {',
  '    "type": "condition",',
  '    "column": "plan",',
  '    "op": "eq",',
  '    "value": "enterprise"',
  '  },',
  '  "sort": [{ "column": "mrr", "direction": "desc" }],',
  '  "page": { "offset": 0, "limit": 25 }',
  '}',
]

const targets = [
  {
    name: 'Postgres',
    via: 'tally-server · Kysely',
    code: ['select * from accounts', 'where plan = $1', 'order by mrr desc', 'limit 25'],
  },
  {
    name: 'SQLite',
    via: 'tally-server · Kysely',
    code: ['select * from accounts', 'where plan = ?', 'order by mrr desc', 'limit 25'],
  },
  {
    name: 'Supabase',
    via: 'tally-adapters · PostgREST',
    code: ['GET /rest/v1/accounts', '  ?plan=eq.enterprise', '  &order=mrr.desc', '  &limit=25'],
  },
] as const

const checks = [
  { column: 'plan', type: 'enum', op: 'eq' },
  { column: 'mrr', type: 'currency', op: 'desc' },
  { column: 'page', type: 'limit', op: '25' },
]

const panel =
  'flex flex-none flex-col rounded-2xl bg-night-3 p-5 shadow-[inset_0_0_0_1px_var(--color-night-line)]'
const caption = 'font-mono text-xs font-medium tracking-[0.05em] text-night-ink-3 uppercase'

function Flow({ delay }: { readonly delay: number }): ReactNode {
  return (
    <div className="relative flex w-11 flex-none items-center">
      <span className="absolute inset-x-1.5 top-1/2 h-px bg-[oklch(0.3_0.014_268)]" />
      <motion.span
        className="absolute top-[calc(50%-3px)] left-1.5 size-1.5 rounded-full bg-[oklch(0.7_0.16_268)]"
        animate={{ x: [0, 30], opacity: [0, 1, 1, 0] }}
        transition={{
          duration: 1.6,
          ease: 'linear',
          repeat: Infinity,
          delay,
          opacity: { times: [0, 0.15, 0.85, 1], duration: 1.6, repeat: Infinity, delay },
        }}
      />
    </div>
  )
}

export function Protocol(): ReactNode {
  const stage = useRef<HTMLDivElement>(null)
  const tick = useTicks(stage, { length: 138, settled: 30 })
  const current = Math.floor(tick / 46) % targets.length
  const step = tick % 46
  const target = targets[current] ?? targets[0]

  return (
    <ExpandSection
      id="protocol"
      label="Tally Query Protocol"
      className="mt-32 bg-night py-30 text-night-ink md:mt-45 md:py-40"
    >
      <div className="mx-auto flex max-w-300 flex-col gap-16 px-4 sm:px-8">
        <SectionHeader
          dark
          index="06"
          label="Tally Query Protocol"
          tone="oklch(0.7 0.16 268)"
          title="The Tally Query Protocol."
          subtitle="One request, compiled for your database."
        />
        <Reveal>
          <FitStage width={1120}>
            <div ref={stage} className="flex items-stretch">
              <div className={`${panel} w-[270px] gap-3`}>
                <div className={caption}>View</div>
                <span className="inline-flex h-8 items-center gap-[7px] self-start rounded-lg bg-night-4 px-3 text-sm font-medium">
                  <span className="text-night-ink-3">plan is</span>Enterprise
                </span>
                <span className="inline-flex h-8 items-center gap-[7px] self-start rounded-lg bg-night-4 px-3 text-sm font-medium">
                  <span className="text-night-ink-3">Sort</span>MRR ↓
                </span>
                <div className="mt-auto flex flex-col gap-2">
                  <div className={caption}>Checked</div>
                  {checks.map((check, index) => (
                    <motion.div
                      key={check.column}
                      className="flex h-7 items-center gap-2 font-mono text-[13px] font-medium"
                      initial={false}
                      animate={{
                        opacity: step >= 3 + index * 2 ? 1 : 0.18,
                        x: step >= 3 + index * 2 ? 0 : -6,
                      }}
                      transition={{ duration: 0.4 }}
                    >
                      <span className="w-[58px] text-night-ink">{check.column}</span>
                      <span className="w-[76px] text-[oklch(0.78_0.13_300)]">{check.type}</span>
                      <span className="text-night-ink-3">{check.op}</span>
                      <span className="ml-auto inline-flex size-4 items-center justify-center rounded-full bg-[oklch(0.76_0.14_155)] text-[10px] font-bold text-night">
                        ✓
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <Flow delay={0} />
              <div className={`${panel} w-100 gap-3.5`}>
                <div className={`${caption} flex justify-between`}>
                  <span>QueryRequest</span>
                  <span>v1</span>
                </div>
                <div className="font-mono text-[13.5px] leading-[22px]">
                  {request.map((line) => (
                    <div key={line} className="h-[22px] whitespace-pre">
                      <Code line={line} />
                    </div>
                  ))}
                </div>
              </div>
              <Flow delay={0.8} />
              <div className={`${panel} w-[362px] gap-3.5`}>
                <div className="flex gap-1.5">
                  {targets.map((item, index) => (
                    <motion.span
                      key={item.name}
                      className="flex h-[30px] items-center rounded-lg px-[11px] text-[13px] font-medium"
                      initial={false}
                      animate={{
                        backgroundColor: index === current ? '#f4f5f8' : '#1a1d24',
                        color: index === current ? '#16181e' : '#9b9ea6',
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {item.name}
                    </motion.span>
                  ))}
                </div>
                <div className="min-h-[154px] font-mono text-[13.5px] leading-[22px]">
                  <AnimatePresence mode="wait">
                    {step < 43 && (
                      <motion.div
                        key={target.name}
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                      >
                        {target.code.map((line, index) => (
                          <motion.div
                            key={line}
                            className="h-[22px] whitespace-pre"
                            initial={false}
                            animate={{
                              opacity: step >= 9 + index * 2 ? 1 : 0,
                              x: step >= 9 + index * 2 ? 0 : -8,
                            }}
                            transition={{ duration: 0.4 }}
                          >
                            <Code line={line} />
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="mt-auto font-mono text-[12.5px] font-medium text-night-ink-3">
                  {target.via}
                </div>
              </div>
            </div>
          </FitStage>
        </Reveal>
      </div>
    </ExpandSection>
  )
}
