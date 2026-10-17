'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { settle } from '@/lib/motion'

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  readonly children: ReactNode
  readonly delay?: number
  readonly className?: string
}): ReactNode {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -6% 0px' }}
      transition={{ duration: 1, ease: settle, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  )
}
