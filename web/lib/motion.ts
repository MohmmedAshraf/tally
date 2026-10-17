import type { Transition } from 'motion/react'

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 }

export const pop: Transition = { type: 'spring', stiffness: 520, damping: 22 }

export const ease = [0.65, 0, 0.35, 1] as const

export const settle = [0.2, 0.7, 0.2, 1] as const
