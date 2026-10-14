export const TODAY = '2026-10-13'

const PERSON_IDS = [
  'amara',
  'mateo',
  'kenji',
  'lena',
  'zeynep',
  'tobias',
  'ananya',
  'omar',
  'mei',
  'noah',
] as const

export type PersonId = (typeof PERSON_IDS)[number]

export const PEOPLE: Readonly<Record<PersonId, string>> = {
  amara: 'Amara Owusu',
  mateo: 'Mateo Ruiz',
  kenji: 'Kenji Sato',
  lena: 'Lena Huber',
  zeynep: 'Zeynep Aydın',
  tobias: 'Tobias Holm',
  ananya: 'Ananya Rao',
  omar: 'Omar Farouk',
  mei: 'Mei Lin',
  noah: 'Noah Brooks',
}

export const TEAM: readonly string[] = PERSON_IDS.map((id) => PEOPLE[id])

export function photoOf(name: string): string | undefined {
  const id = PERSON_IDS.find((candidate) => PEOPLE[candidate] === name)
  return id === undefined ? undefined : `/people/${id}.webp`
}

export type Random = () => number

export function random(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(next: Random, list: readonly T[]): T {
  return list[Math.floor(next() * list.length)]!
}

export function weighted<T>(next: Random, pairs: readonly (readonly [T, number])[]): T {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = next() * total
  for (const [value, weight] of pairs) {
    roll -= weight
    if (roll < 0) return value
  }
  return pairs.at(-1)![0]
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
