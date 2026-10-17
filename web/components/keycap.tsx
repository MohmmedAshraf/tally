'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export function Keycap({
  glyph,
  label,
  pressed,
}: {
  readonly glyph: string
  readonly label: string
  readonly pressed: boolean
}): ReactNode {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-28 w-[150px] items-center justify-center">
        <motion.div
          aria-hidden
          className="relative size-[96px] rounded-[22px] bg-[linear-gradient(180deg,oklch(0.3_0.008_265),oklch(0.2_0.008_265))]"
          initial={false}
          animate={{
            y: pressed ? 6 : 0,
            scale: pressed ? 0.97 : 1,
            boxShadow: pressed
              ? '0 2px 0 0 #0b0c10, 0 4px 14px 0 rgba(60, 92, 221, 0.55)'
              : '0 8px 0 0 #0b0c10, 0 18px 22px -4px rgba(22, 24, 30, 0.35)',
          }}
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        >
          <motion.span
            className="absolute inset-x-[9px] top-[6px] bottom-[12px] flex items-center justify-center rounded-[14px] bg-[linear-gradient(160deg,oklch(0.42_0.008_265),oklch(0.32_0.008_265))] text-[30px] font-semibold shadow-[inset_0_1px_0_oklch(1_0_0/.18)]"
            initial={false}
            animate={{ color: pressed ? '#ffffff' : '#d7d9de' }}
          >
            {glyph}
          </motion.span>
        </motion.div>
      </div>
      <span className="mt-2 text-[13px] font-medium text-ink-3">{label}</span>
    </div>
  )
}
