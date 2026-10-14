import { useEffect, useRef, useState } from 'react'

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz<>=0123456789'

const DECODE_MS = 560

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function glyph(index: number, seed: number): string {
  const noise = Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233)) * 43758.5453
  return GLYPHS[Math.floor(noise) % GLYPHS.length] ?? ''
}

function scramble(from: string, to: string, progress: number, seed: number): string {
  if (progress >= 1) return to
  const length = Math.round(from.length + (to.length - from.length) * Math.min(1, progress * 1.6))
  let out = ''
  for (let index = 0; index < length; index += 1) {
    const char = to[index]
    if (progress >= (index + 1) / length) out += char ?? ''
    else if (progress <= 0) out += from[index] ?? ''
    else if (char === ' ' || char === undefined) out += ' '
    else out += glyph(index, seed)
  }
  return out
}

export function animateDecode(
  from: string,
  to: string,
  onFrame: (text: string) => void,
  onDone: () => void,
): () => void {
  const duration = reducedMotion() ? 0 : DECODE_MS
  const start = performance.now()
  let frame = requestAnimationFrame(function tick(now) {
    const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
    onFrame(scramble(from, to, progress, Math.floor(now / 40)))
    if (progress < 1) frame = requestAnimationFrame(tick)
    else onDone()
  })
  return () => cancelAnimationFrame(frame)
}

export function useDecoded(text: string): string {
  const [shown, setShown] = useState(text)
  const previous = useRef(text)
  useEffect(() => {
    const from = previous.current
    previous.current = text
    if (from === '' || from === text || reducedMotion()) {
      setShown(text)
      return
    }
    return animateDecode(from, text, setShown, () => undefined)
  }, [text])
  return reducedMotion() ? text : shown
}

export function flash(element: HTMLElement | null, attribute: string, ms: number): void {
  if (element === null || reducedMotion()) return
  element.setAttribute(attribute, '')
  setTimeout(() => element.removeAttribute(attribute), ms)
}
