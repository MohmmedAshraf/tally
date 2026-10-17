'use client'

import { motion, type MotionStyle } from 'motion/react'
import type { ReactNode } from 'react'

export function Caret({
  color,
  className,
}: {
  readonly color: string
  readonly className?: string
}): ReactNode {
  return (
    <motion.span
      aria-hidden
      className={`inline-block ${className ?? 'h-5 w-0.5'}`}
      style={{ background: color }}
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, times: [0, 0.49, 0.5, 1], repeat: Infinity, ease: 'linear' }}
    />
  )
}

export function Shimmer({
  className,
  style,
  duration = 1.4,
  children,
}: {
  readonly className?: string
  readonly style?: MotionStyle
  readonly duration?: number
  readonly children?: ReactNode
}): ReactNode {
  return (
    <motion.span
      className={className}
      style={{ backgroundSize: '200% 100%', ...style }}
      animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
      transition={{ duration, ease: 'linear', repeat: Infinity }}
    >
      {children}
    </motion.span>
  )
}
