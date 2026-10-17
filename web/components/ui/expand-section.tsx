'use client'

import { motion, useMotionTemplate, useScroll, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'

export function ExpandSection({
  id,
  label,
  className,
  children,
}: {
  readonly id?: string
  readonly label: string
  readonly className?: string
  readonly children: ReactNode
}): ReactNode {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.25'] })
  const inset = useTransform(scrollYProgress, [0, 1], [5, 0], { clamp: true })
  const radius = useTransform(scrollYProgress, [0, 1], [44, 0], { clamp: true })
  const clipPath = useMotionTemplate`inset(0 min(56px, ${inset}vw) round ${radius}px)`

  return (
    <motion.section ref={ref} id={id} aria-label={label} className={className} style={{ clipPath }}>
      {children}
    </motion.section>
  )
}
