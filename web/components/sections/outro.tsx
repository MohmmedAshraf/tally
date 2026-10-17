import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  authorAvatarUrl,
  authorGithubUrl,
  authorXUrl,
  docsUrl,
  githubUrl,
  playgroundUrl,
} from '@/lib/links'
import { CopyInstall } from '../copy-install'
import { GithubIcon, XIcon } from '../icons'
import { TallyMark } from '../tally-mark'
import { ExpandSection } from '../ui/expand-section'
import { Reveal } from '../ui/reveal'

const footerLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Protocol', href: '#protocol' },
  { label: 'Docs', href: docsUrl },
  { label: 'Playground', href: playgroundUrl },
  { label: 'GitHub', href: githubUrl },
]

export function Outro(): ReactNode {
  return (
    <ExpandSection
      label="Get Tally"
      className="relative mt-30 overflow-hidden bg-night pt-30 pb-20 text-night-ink md:mt-[150px] md:pt-40 md:pb-30"
    >
      <div className="relative mx-auto flex max-w-300 flex-col items-center gap-[30px] px-4 text-center sm:px-8">
        <Reveal>
          <TallyMark size={96} dark />
        </Reveal>
        <Reveal delay={80}>
          <h2 className="m-0 max-w-245 text-[clamp(44px,7vw,96px)] leading-[0.98] font-bold tracking-[-0.05em] text-balance">
            Tally.{' '}
            <span className="text-night-ink-3">Open source, and ready for your next big idea.</span>
          </h2>
        </Reveal>
        <Reveal delay={160} className="flex flex-wrap justify-center gap-3">
          <a
            href={githubUrl}
            className="flex h-[52px] items-center gap-[9px] rounded-xl bg-night-ink px-6 text-[15px] leading-none font-semibold text-ink hover:bg-white"
          >
            <span className="size-2 rounded-[2px] bg-brand" />
            Star on GitHub
          </a>
          <CopyInstall dark />
        </Reveal>
      </div>
      <footer className="relative mx-auto mt-24 flex max-w-300 flex-col gap-12 border-t border-[oklch(0.22_0.012_268)] px-4 pt-14 sm:px-8 md:mt-35">
        <Reveal>
          <div className="relative flex flex-wrap items-center gap-9 overflow-hidden rounded-3xl bg-night-2 p-7 shadow-[0_0_0_1px_oklch(0.25_0.013_268)] max-sm:flex-col max-sm:gap-6 max-sm:text-center sm:p-11">
            <div className="relative size-35 flex-none rounded-full p-1 shadow-[0_0_0_1px_oklch(0.3_0.013_268)]">
              <Image
                src={authorAvatarUrl}
                alt="Mohamed Ashraf"
                width={132}
                height={132}
                className="size-33 rounded-full bg-[oklch(0.2_0.012_268)] object-cover"
              />
            </div>
            <div className="flex min-w-65 flex-1 flex-col gap-3.5 max-sm:min-w-0 max-sm:items-center">
              <span className="font-mono text-[13px] leading-none font-medium tracking-[0.06em] text-night-ink-3 uppercase">
                Made by
              </span>
              <span className="text-[clamp(36px,4.6vw,60px)] leading-[0.98] font-bold tracking-[-0.045em]">
                Mohamed Ashraf
              </span>
              <span className="text-[17px] leading-[1.4] text-[oklch(0.72_0.012_265)]">
                Designed and built Tally.
              </span>
            </div>
            <div className="flex flex-col gap-2.5 max-lg:w-full sm:max-lg:flex-row lg:min-w-55">
              <a
                href={authorXUrl}
                className="flex h-[54px] items-center gap-3 rounded-[14px] bg-night-ink px-5 sm:max-lg:flex-1 text-[15px] leading-none font-semibold text-ink hover:bg-white"
              >
                <XIcon size={17} />
                Follow on X<span className="ml-auto">→</span>
              </a>
              <a
                href={authorGithubUrl}
                className="flex h-[54px] items-center gap-3 rounded-[14px] bg-night-4 px-5 sm:max-lg:flex-1 text-[15px] leading-none font-semibold text-night-ink shadow-[inset_0_0_0_1px_oklch(0.32_0.014_268)] hover:bg-[oklch(0.27_0.014_268)] hover:text-white"
              >
                <GithubIcon size={18} />
                GitHub<span className="ml-auto">→</span>
              </a>
            </div>
          </div>
        </Reveal>
        <div className="flex flex-wrap items-center gap-5 text-[13.5px] text-night-ink-3">
          <span className="flex items-center gap-2 text-night-ink">
            <TallyMark size={20} dark animate={false} />
            <b className="text-base font-bold tracking-[-0.04em]">tally</b>
          </span>
          <span>MIT License</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-5 sm:ml-auto">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[oklch(0.75_0.01_265)] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </ExpandSection>
  )
}
