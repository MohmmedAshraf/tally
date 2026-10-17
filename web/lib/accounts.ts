export type PersonId =
  'amara' | 'ananya' | 'kenji' | 'lena' | 'mateo' | 'mei' | 'noah' | 'omar' | 'tobias' | 'zeynep'

type Plan = 'Enterprise' | 'Team' | 'Pro' | 'Free'

export type Status = 'Active' | 'Trial' | 'Past due' | 'Churned'

export interface Account {
  readonly name: string
  readonly person: PersonId
  readonly owner: string
  readonly plan: Plan
  readonly status: Status
  readonly mrr: number
  readonly growth: number
  readonly health: number
  readonly renews: string
}

function account(
  name: string,
  person: PersonId,
  owner: string,
  plan: Plan,
  status: Status,
  mrr: number,
  growth: number,
  health: number,
  renews: string,
): Account {
  return { name, person, owner, plan, status, mrr, growth, health, renews }
}

export const accounts: readonly Account[] = [
  account(
    'Atlas Freight',
    'kenji',
    'Kenji Sato',
    'Enterprise',
    'Past due',
    26480,
    21.1,
    42,
    'Oct 13',
  ),
  account(
    'Northwind Labs',
    'amara',
    'Amara Owusu',
    'Enterprise',
    'Active',
    24380,
    6.6,
    67,
    'Nov 17',
  ),
  account('Vector Cloud', 'zeynep', 'Zeynep Aydın', 'Enterprise', 'Trial', 10930, -7, 79, 'Oct 15'),
  account('Meridian Energy', 'lena', 'Lena Huber', 'Team', 'Trial', 8380, -6.1, 39, 'Feb 1'),
  account('Granite Capital', 'tobias', 'Tobias Holm', 'Team', 'Churned', 7540, 6.8, 80, 'Jun 26'),
  account('Kestrel Air', 'mateo', 'Mateo Ruiz', 'Team', 'Trial', 6990, -2.2, 82, 'Dec 18'),
  account('Saffron Works', 'mateo', 'Mateo Ruiz', 'Team', 'Active', 6240, 6.6, 50, 'Jun 26'),
  account('Halcyon Health', 'lena', 'Lena Huber', 'Team', 'Active', 5120, 2.8, 50, 'Jan 16'),
  account('Copper Analytics', 'tobias', 'Tobias Holm', 'Team', 'Active', 5010, 13.4, 85, 'Sep 20'),
  account('Quill & Co', 'noah', 'Noah Brooks', 'Team', 'Active', 4040, -8.2, 69, 'Aug 9'),
  account('Harbor Analytics', 'omar', 'Omar Farouk', 'Team', 'Active', 3910, 8.6, 77, 'Feb 12'),
  account('Bright Systems', 'ananya', 'Ananya Rao', 'Pro', 'Trial', 1260, 18.2, 76, 'Jan 10'),
  account('Juniper Bank', 'tobias', 'Tobias Holm', 'Pro', 'Active', 980, 9.6, 50, 'Jan 11'),
  account('Lumen Robotics', 'mei', 'Mei Lin', 'Free', 'Churned', 0, -2, 85, 'Oct 16'),
]

export function accountAt(index: number): Account {
  const found = accounts[index]
  if (found === undefined) throw new RangeError(`No account at ${index}`)
  return found
}

export const statusColor: Readonly<Record<Status, string>> = {
  Active: 'var(--color-up)',
  Trial: 'var(--color-accent)',
  'Past due': 'var(--color-warn)',
  Churned: 'var(--color-grey)',
}

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function percent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(1)}%`
}

export function healthColor(health: number): string {
  if (health < 55) return 'var(--color-down)'
  if (health < 70) return 'var(--color-warn)'
  return 'var(--color-up)'
}

export function growthColor(growth: number): string {
  return growth >= 0 ? 'var(--color-up)' : 'var(--color-down)'
}

export function photo(person: PersonId): string {
  return `/people/${person}.webp`
}
