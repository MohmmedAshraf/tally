export const hex = {
  ink: '#16181e',
  ink2: '#545860',
  accent: '#3c5cdd',
  brand: '#009b95',
  line: '#e3e5e9',
  up: '#14874e',
  upInk: '#005f2e',
  upSoft: '#daf7e3',
  down: '#cc3336',
  downInk: '#a9131f',
  downSoft: '#ffe7e4',
} as const

export function alpha(color: string, amount: number): string {
  const channel = Math.round(Math.max(0, Math.min(1, amount)) * 255)
  return `${color}${channel.toString(16).padStart(2, '0')}`
}
