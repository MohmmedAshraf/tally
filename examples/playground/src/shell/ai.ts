import { createAnthropic } from '@ai-sdk/anthropic'
import { useEffect, useState } from 'react'

const ENDPOINT = '/api/anthropic'

const anthropic = createAnthropic({ baseURL: `${ENDPOINT}/v1`, apiKey: 'proxied' })

export const models = {
  ask: anthropic('claude-sonnet-5-5'),
  design: anthropic('claude-sonnet-5-5'),
  fill: anthropic('claude-haiku-5-5'),
}

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

export function useAiAvailable(): boolean {
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
