import Image from 'next/image'
import type { ReactNode } from 'react'
import { accounts } from '@/lib/accounts'
import { authorAvatarUrl, authorXUrl } from '@/lib/links'
import { Avatar } from '../ui/avatar'
import { CopyInstall } from '../copy-install'
import { FitStage } from '../ui/fit-stage'
import { HeroGrid } from '../hero-grid'
import { AuthorPill } from '../author-pill'
import { Reveal } from '../ui/reveal'

const shown = accounts.slice(0, 10)
const atRisk = shown.filter((item) => item.health < 55).length
const enterprise = shown.filter((item) => item.plan === 'Enterprise').length

const views = [
  { name: 'At risk', color: 'var(--color-down)' },
  { name: 'Renewals Q4', color: 'var(--color-accent)' },
  { name: 'Expansion', color: 'var(--color-up)' },
  { name: 'Enterprise', color: 'var(--color-warn)' },
]

const words = ['Every', 'app', 'ends', 'up', 'with', 'a']

function Count({ children }: { readonly children: ReactNode }): ReactNode {
  return <span className="ml-auto font-mono text-xs font-medium text-ink-3">{children}</span>
}

function Shell(): ReactNode {
  return (
    <div className="flex overflow-hidden rounded-[18px] border border-line bg-white shadow-[inset_0_1px_0_#fff,0_40px_80px_-30px_oklch(0.3_0.04_268/.28),0_12px_30px_-12px_oklch(0.3_0.04_268/.12)]">
      <aside className="flex w-49 flex-none flex-col gap-[18px] border-r border-line bg-[oklch(0.983_0.003_265)] px-3 py-4">
        <div className="flex items-center gap-2.5 px-1.5 py-1">
          <div className="flex size-[30px] items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            M
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="text-sm leading-none font-semibold">Meridian</span>
            <span className="text-xs leading-none text-ink-3">Revenue workspace</span>
          </div>
        </div>
        <div className="flex h-[34px] items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink-3">
          <span className="size-[11px] rounded-full border-[1.5px] border-ink-3" />
          Search
          <span className="ml-auto font-mono text-[11px] font-medium">⌘K</span>
        </div>
        <div className="flex flex-col gap-0.5 text-[13.5px] font-medium text-ink-2">
          <div className="flex h-[34px] items-center rounded-lg px-2.5">Home</div>
          <div className="flex h-[34px] items-center rounded-lg bg-white px-2.5 text-ink shadow-[0_0_0_1px_var(--color-line)]">
            Accounts<Count>{shown.length}</Count>
          </div>
          <div className="flex h-[34px] items-center px-2.5">
            Deals<Count>86</Count>
          </div>
          <div className="flex h-[34px] items-center px-2.5">
            Invoices<Count>1.2k</Count>
          </div>
          <div className="flex h-[34px] items-center px-2.5">Reports</div>
        </div>
        <div className="flex flex-col gap-0.5 text-[13.5px] font-medium text-ink-2">
          <div className="px-2.5 pb-1.5 text-[11.5px] text-ink-3">Views</div>
          {views.map((view) => (
            <div key={view.name} className="flex h-8 items-center gap-2.5 px-2.5">
              <span className="size-[7px] rounded-full" style={{ background: view.color }} />
              {view.name}
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1.5 py-2">
          <Avatar person="amara" size={30} />
          <div className="flex flex-col gap-[3px]">
            <span className="text-[13px] leading-none font-semibold">Amara Owusu</span>
            <span className="text-xs leading-none text-ink-3">Head of Revenue</span>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[54px] items-center gap-[22px] border-b border-line px-[18px] text-[13.5px] font-medium text-ink-2">
          <span className="font-semibold text-ink">Accounts</span>
          <span className="flex h-[54px] items-center gap-[7px] text-ink shadow-[inset_0_-2px_0_var(--color-ink)]">
            All accounts
            <span className="font-mono text-xs text-ink-3">{shown.length}</span>
          </span>
          <span className="flex gap-[7px]">
            At risk<span className="font-mono text-xs text-ink-3">{atRisk}</span>
          </span>
          <span className="flex gap-[7px]">
            Enterprise by owner<span className="font-mono text-xs text-ink-3">{enterprise}</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex">
              <Avatar person="kenji" size={28} className="border-2 border-white" />
              <Avatar person="lena" size={28} className="-ml-2 border-2 border-white" />
              <Avatar person="omar" size={28} className="-ml-2 border-2 border-white" />
            </div>
            <span className="flex h-8 items-center rounded-lg border border-line px-3 text-ink">
              Share
            </span>
          </div>
        </div>
        <div className="h-[656px]">
          <HeroGrid />
        </div>
      </div>
    </div>
  )
}

export function Hero(): ReactNode {
  return (
    <header
      id="top"
      className="relative overflow-hidden bg-[radial-gradient(1200px_600px_at_50%_0%,#ffffff_0%,var(--color-canvas)_70%)] pt-16 md:pt-24"
    >
      <div className="mx-auto flex max-w-300 flex-col items-center gap-7 px-4 text-center sm:px-8">
        <AuthorPill href={authorXUrl}>
          <Image
            src={authorAvatarUrl}
            alt=""
            width={26}
            height={26}
            className="size-[26px] flex-none rounded-full object-cover"
          />
        </AuthorPill>
        <h1 className="m-0 flex max-w-250 flex-wrap justify-center gap-x-[0.24em] text-[clamp(46px,7.6vw,108px)] leading-[0.96] font-bold tracking-[-0.05em]">
          {words.map((word) => (
            <span key={word}>{word}</span>
          ))}
          <span className="text-accent">table.</span>
        </h1>
        <p className="m-0 max-w-160 text-[clamp(17px,1.6vw,21px)] leading-normal text-pretty text-ink-2">
          Meet Tally, the open-source data table. Typed columns, a query language, live data and AI,
          built in.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <CopyInstall />
          <a
            href="#features"
            className="flex h-[50px] items-center rounded-xl bg-accent px-[22px] text-[15px] leading-none font-semibold text-white hover:bg-accent-deep"
          >
            See what it does
          </a>
        </div>
      </div>
      <Reveal delay={200} className="relative z-10 mx-auto mt-18 max-w-335 px-4 sm:px-6">
        <FitStage width={1280}>
          <Shell />
        </FitStage>
      </Reveal>
    </header>
  )
}
