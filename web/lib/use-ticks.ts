'use client'

import {
  animate,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react'
import { useEffect, useState, type RefObject } from 'react'

export interface TicksOptions {
  readonly length: number
  readonly settled: number
  readonly tickMs?: number
}

export function useTicks(
  ref: RefObject<Element | null>,
  { length, settled, tickMs = 100 }: TicksOptions,
): number {
  const reduce = useReducedMotion() === true
  const inView = useInView(ref, { margin: '-15% 0px -15% 0px' })
  const clock = useMotionValue(0)
  const [tick, setTick] = useState(0)

  useMotionValueEvent(clock, 'change', (value) => setTick(Math.floor(value) % length))

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(clock, [0, length], {
      duration: (length * tickMs) / 1000,
      ease: 'linear',
      repeat: Infinity,
    })
    return () => controls.stop()
  }, [clock, inView, length, reduce, tickMs])

  return reduce ? settled : tick
}
