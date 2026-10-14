import { useEffect, useState } from 'react'
import { parseQuery } from 'tally-core'
import type { AskHandler } from 'tally-react'

const ENDPOINT = '/api/ask'

let availability: Promise<boolean> | undefined

function checkAvailability(): Promise<boolean> {
  availability ??= fetch(ENDPOINT)
    .then(async (response) => {
      const body: unknown = response.ok ? await response.json() : undefined
      if (typeof body !== 'object' || body === null) return false
      return (body as { available?: unknown }).available === true
    })
    .catch(() => false)
  return availability
}

export function useAskAvailable(): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let active = true
    const check = async (): Promise<void> => {
      const value = await checkAvailability()
      if (active) setAvailable(value)
    }
    void check()
    return () => {
      active = false
    }
  }, [])
  return available
}

export function createRemoteAsk(dataset: string): AskHandler {
  return async (question, grid) => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataset, question }),
    })
    const body: unknown = await response.json()
    const { text, explanation, message } =
      typeof body === 'object' && body !== null
        ? (body as { text?: unknown; explanation?: unknown; message?: unknown })
        : {}
    if (!response.ok || typeof text !== 'string') {
      throw new Error(typeof message === 'string' ? message : response.statusText)
    }
    const parsed = parseQuery(text, grid.schema)
    const error = parsed.errors[0]
    if (error !== undefined) throw new Error(error.message)
    return { query: parsed.query, explanation: typeof explanation === 'string' ? explanation : '' }
  }
}
