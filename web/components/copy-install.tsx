'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'

const command = 'pnpm add tally-react'

export function CopyInstall({ dark = false }: { readonly dark?: boolean }): ReactNode {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = (): void => {
    navigator.clipboard.writeText(command).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${command}`}
      className={`flex h-[50px] cursor-pointer items-center gap-3.5 rounded-xl border pr-2.5 pl-5 font-mono text-[15px] leading-none font-medium transition-colors ${
        dark
          ? 'h-[52px] border-[oklch(0.3_0.014_268)] bg-night-3 text-night-ink hover:border-[oklch(0.7_0.16_268)]'
          : 'border-[oklch(0.85_0.008_265)] bg-white text-ink hover:border-accent'
      }`}
    >
      <span className={dark ? 'text-night-ink-4' : 'text-ink-3'}>$</span>
      {command}
      <span
        className={`relative flex h-8 w-[66px] items-center justify-center overflow-hidden rounded-lg font-sans text-[12.5px] leading-none font-medium ${
          dark ? 'bg-night-4 text-[oklch(0.75_0.01_265)]' : 'bg-chip text-ink-2'
        }`}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? 'copied' : 'copy'}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          >
            {copied ? 'Copied' : 'Copy'}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  )
}
