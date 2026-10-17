import Link from 'next/link'
import type { ReactNode } from 'react'
import { docsUrl, githubUrl, playgroundUrl, authorXUrl } from '@/lib/links'
import { GithubIcon, XIcon } from './icons'
import { TallyMark } from './tally-mark'

const linkClass =
  'flex h-9 items-center gap-[7px] rounded-full px-3.5 text-[oklch(0.78_0.01_265)] transition-colors hover:bg-white/8 hover:text-white'

const iconClass =
  'flex size-10 items-center justify-center rounded-full text-[oklch(0.85_0.008_265)] hover:bg-white/8 hover:text-white'

export function Nav(): ReactNode {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none sticky top-0 z-50 flex justify-center px-4 pt-4"
    >
      <div className="pointer-events-auto flex h-14 w-full max-w-205 items-center gap-1.5 rounded-full bg-[oklch(0.17_0.012_268/.88)] pr-2 pl-2.5 shadow-[inset_0_1px_0_oklch(1_0_0/.08),0_0_0_1px_oklch(0.28_0.014_268),0_18px_40px_-16px_oklch(0.2_0.05_268/.55)] backdrop-blur-[10px]">
        <Link
          href="/"
          className="flex h-10 items-center gap-2.5 rounded-full pr-3.5 pl-1.5 text-white hover:bg-white/6"
        >
          <TallyMark size={28} dark />
          <span className="text-xl leading-none font-bold tracking-[-0.045em]">tally</span>
        </Link>
        <span className="hidden h-[22px] w-px bg-[oklch(0.32_0.014_268)] md:block" />
        <div className="ml-1 hidden gap-0.5 text-sm leading-none font-medium md:flex">
          <a href="#features" className={linkClass}>
            Features
          </a>
          <a href="#protocol" className={linkClass}>
            Protocol
          </a>
          <a href={docsUrl} className={linkClass}>
            Docs
          </a>
          <a href={playgroundUrl} className={linkClass}>
            Playground
            <span className="size-1.5 rounded-full bg-live" />
          </a>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <a href={authorXUrl} aria-label="X" className={`${iconClass} max-sm:hidden`}>
            <XIcon size={15} />
          </a>
          <a href={githubUrl} aria-label="GitHub" className={iconClass}>
            <GithubIcon size={18} />
          </a>
          <a
            href={githubUrl}
            className="flex h-10 items-center gap-2 rounded-full bg-[oklch(0.97_0.004_265)] pr-4 pl-3.5 text-sm leading-none font-semibold text-ink shadow-[inset_0_-2px_0_oklch(0.88_0.006_265)] hover:bg-white"
          >
            <span className="text-sm text-[oklch(0.72_0.15_75)]" aria-hidden>
              ★
            </span>
            Star on GitHub
          </a>
        </div>
      </div>
    </nav>
  )
}
