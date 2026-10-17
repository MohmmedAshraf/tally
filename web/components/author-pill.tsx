'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export function AuthorPill({
  href,
  children,
}: {
  readonly href: string
  readonly children: ReactNode
}): ReactNode {
  return (
    <motion.a
      href={href}
      className="inline-flex rounded-full p-[1.5px] whitespace-nowrap text-ink shadow-[0_10px_30px_-14px_oklch(0.4_0.12_268/.45)]"
      style={{
        backgroundImage:
          'linear-gradient(90deg, oklch(0.9 0.006 265), oklch(0.62 0.11 190), oklch(0.53 0.2 268), oklch(0.6 0.2 300), oklch(0.9 0.006 265))',
        backgroundSize: '300% 100%',
      }}
      animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
      transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
      whileHover={{ y: -2 }}
    >
      <span className="flex h-[42px] items-center gap-1 rounded-full bg-white p-1">
        <span className="flex h-[34px] items-center gap-2 rounded-full bg-pill px-3.5 text-[13px] leading-none font-semibold text-white">
          <motion.span
            className="size-[7px] rounded-full bg-live"
            animate={{
              boxShadow: [
                '0 0 0 0 oklch(0.55 0.13 155 / .5)',
                '0 0 0 9px oklch(0.55 0.13 155 / 0)',
              ],
            }}
            transition={{ duration: 1.6, ease: 'easeOut', repeat: Infinity }}
          />
          Open source
        </span>
        <span className="flex items-center gap-[9px] pr-3 pl-2 text-sm leading-none font-medium text-ink-2">
          by
          {children}
          <b className="font-[650] text-ink">Mohamed Ashraf</b>
          <span className="flex size-[22px] items-center justify-center rounded-full bg-[oklch(0.955_0.004_265)] text-xs leading-none font-semibold text-ink">
            →
          </span>
        </span>
      </span>
    </motion.a>
  )
}
