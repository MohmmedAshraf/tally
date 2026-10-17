import type { ReactNode } from 'react'
import { Reveal } from './reveal'

export function SectionHeader({
  index,
  label,
  tone,
  title,
  subtitle,
  dark = false,
}: {
  readonly index: string
  readonly label: string
  readonly tone: string
  readonly title: string
  readonly subtitle: string
  readonly dark?: boolean
}): ReactNode {
  return (
    <div className="flex flex-col gap-[22px]">
      <Reveal>
        <p
          className={`flex gap-2.5 font-mono text-[13px] leading-none font-medium tracking-[0.04em] uppercase ${dark ? 'text-night-ink-3' : 'text-ink-3'}`}
        >
          <span style={{ color: tone }}>{index}</span>
          {label}
        </p>
      </Reveal>
      <Reveal delay={60}>
        <h2 className="m-0 text-[clamp(30px,3.6vw,48px)] leading-[1.08] font-bold tracking-[-0.035em] text-balance">
          {title}
          <br />
          <span className={dark ? 'text-night-ink-4' : 'text-ink-3'}>{subtitle}</span>
        </h2>
      </Reveal>
    </div>
  )
}

export function Section({
  id,
  label,
  children,
}: {
  readonly id?: string
  readonly label: string
  readonly children: ReactNode
}): ReactNode {
  return (
    <section id={id} aria-label={label} className="pt-32 md:pt-45">
      <div className="mx-auto flex max-w-300 flex-col gap-16 px-4 sm:px-8">{children}</div>
    </section>
  )
}
