'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { ease } from '@/lib/motion'

const cells = [0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => ({ row, column })))

const path = {
  x: [6, 6, 28, 28, 28, 28, 50, 50, 6, 6, 6, 6],
  y: [6, 6, 6, 6, 28, 28, 28, 28, 6, 6, 6, 6],
  size: [16, 16, 16, 16, 16, 16, 16, 16, 60, 60, 16, 16],
  opacity: [1, 1, 1, 1, 1, 1, 1, 1, 0.24, 0.24, 1, 1],
  times: [0, 0.1, 0.16, 0.26, 0.32, 0.42, 0.48, 0.56, 0.64, 0.8, 0.88, 1],
}

interface Paint {
  readonly color: string
  readonly stroke?: number
}

function grow(values: readonly number[], by: number): number[] {
  return values.map((value) => value + by)
}

export function TallyMark({
  size = 72,
  dark = false,
  animate = true,
  className,
}: {
  readonly size?: number
  readonly dark?: boolean
  readonly animate?: boolean
  readonly className?: string
}): ReactNode {
  const reduce = useReducedMotion() === true
  const moving = animate && !reduce
  const background = dark ? 'var(--color-ink)' : '#ffffff'
  const faint = dark
    ? 'color-mix(in oklch, #ffffff 18%, transparent)'
    : 'color-mix(in oklch, var(--color-ink) 11%, transparent)'
  const transition = { duration: 4.4, ease, times: path.times, repeat: Infinity }

  const layer = (inset: number, paint: Paint): ReactNode => {
    const fill = paint.stroke === undefined ? paint.color : 'none'
    const stroke = paint.stroke === undefined ? undefined : paint.color
    return moving ? (
      <motion.rect
        fill={fill}
        stroke={stroke}
        strokeWidth={paint.stroke}
        initial={false}
        animate={{
          x: grow(path.x, -inset),
          y: grow(path.y, -inset),
          width: grow(path.size, inset * 2),
          height: grow(path.size, inset * 2),
          ...(paint.stroke === undefined ? { fillOpacity: path.opacity } : {}),
        }}
        rx={4 + inset}
        transition={transition}
      />
    ) : (
      <rect
        x={28 - inset}
        y={28 - inset}
        width={16 + inset * 2}
        height={16 + inset * 2}
        rx={4 + inset}
        fill={fill}
        stroke={stroke}
        strokeWidth={paint.stroke}
      />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={className}
      aria-hidden
      focusable="false"
    >
      {cells.map(({ row, column }) => (
        <rect
          key={`${row}-${column}`}
          x={6 + column * 22}
          y={6 + row * 22}
          width={16}
          height={16}
          rx={4}
          fill={faint}
        />
      ))}
      {layer(1.25, { color: background, stroke: 2.5 })}
      {layer(3.5, { color: 'var(--color-brand)', stroke: 2 })}
      {layer(0, { color: 'var(--color-brand)' })}
    </svg>
  )
}
