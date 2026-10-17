import type { ReactNode } from 'react'
import { growthColor, percent, type Account } from '@/lib/accounts'
import { Avatar } from './avatar'
import { HealthBar, PlanTag, StatusDot } from './cells'

export const ROW_HEIGHT = 46

export function TableHead({
  mrr,
  growth,
}: {
  readonly mrr: ReactNode
  readonly growth: ReactNode
}): ReactNode {
  return (
    <div className="flex h-[42px] items-center border-b border-line bg-surface text-[13px] font-medium text-ink-2">
      <div className="w-11 flex-none" />
      <div className="w-55 flex-none">Account</div>
      <div className="w-[190px] flex-none">Owner</div>
      <div className="w-30 flex-none">Plan</div>
      <div className="w-[130px] flex-none">Status</div>
      <div className="flex w-[110px] flex-none justify-end">{mrr}</div>
      <div className="flex w-25 flex-none justify-end">{growth}</div>
      <div className="w-[126px] flex-none pl-[26px]">Health</div>
      <div className="w-20 flex-none">Renews</div>
    </div>
  )
}

export function AccountCells({
  index,
  item,
  name,
  mrr,
}: {
  readonly index: number
  readonly item: Account
  readonly name?: ReactNode
  readonly mrr: ReactNode
}): ReactNode {
  return (
    <>
      <div className="w-11 flex-none text-center font-mono text-xs text-ink-3">{index}</div>
      <div className="flex w-55 flex-none items-center gap-2 font-[550]">
        {item.name}
        {name}
      </div>
      <div className="flex w-[190px] flex-none items-center gap-[9px]">
        <Avatar person={item.person} size={26} />
        {item.owner}
      </div>
      <div className="w-30 flex-none">
        <PlanTag plan={item.plan} />
      </div>
      <div className="flex w-[130px] flex-none items-center gap-2">
        <StatusDot status={item.status} />
        {item.status}
      </div>
      <div className="flex w-[110px] flex-none justify-end">{mrr}</div>
      <div
        className="w-25 flex-none text-right font-mono text-sm font-medium"
        style={{ color: growthColor(item.growth) }}
      >
        {percent(item.growth)}
      </div>
      <div className="flex w-[126px] flex-none items-center gap-2.5 pl-[26px]">
        <HealthBar health={item.health} />
        <span className="font-mono text-[12.5px] font-medium text-ink-2">{item.health}</span>
      </div>
      <div className="w-20 flex-none text-ink-2">{item.renews}</div>
    </>
  )
}

export function TableFoot({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="flex h-[46px] items-center border-t border-line bg-surface px-5 text-[13.5px] text-ink-3">
      {children}
    </div>
  )
}

export const rowClass =
  'absolute inset-x-0 top-0 flex items-center border-b border-line-soft bg-white text-sm'

export const cardClass =
  'overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_60px_-30px_oklch(0.3_0.04_268/.22)]'
