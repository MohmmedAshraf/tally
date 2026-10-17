import type { ReactNode } from 'react'
import { healthColor, statusColor, type Status } from '@/lib/accounts'

export function StatusDot({ status }: { readonly status: Status }): ReactNode {
  const color = statusColor[status]
  return (
    <span
      className="size-[7px] shrink-0 rounded-full"
      style={{
        background: color,
        boxShadow: `0 0 0 3px color-mix(in oklch, ${color} 18%, transparent)`,
      }}
    />
  )
}

export function HealthBar({
  health,
  width = 56,
}: {
  readonly health: number
  readonly width?: number
}): ReactNode {
  return (
    <span className="block h-1 overflow-hidden rounded-xs bg-track" style={{ width }}>
      <span
        className="block h-1"
        style={{ width: `${health}%`, background: healthColor(health) }}
      />
    </span>
  )
}

export function PlanTag({ plan }: { readonly plan: string }): ReactNode {
  return (
    <span className="rounded-md border border-line bg-white px-[9px] py-[3px] text-[12.5px] text-ink-2">
      {plan}
    </span>
  )
}
