import { z } from 'zod'

export class HttpSourceError extends Error {
  readonly status: number
  readonly code: string
  readonly details: readonly string[]

  constructor(status: number, code: string, message: string, details: readonly string[] = []) {
    super(message)
    this.name = 'HttpSourceError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(z.string()).readonly().default([]),
})

export async function errorFrom(response: Response): Promise<HttpSourceError> {
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = undefined
  }
  const parsed = errorBodySchema.safeParse(body)
  if (parsed.success) {
    return new HttpSourceError(
      response.status,
      parsed.data.code,
      parsed.data.message,
      parsed.data.details,
    )
  }
  return new HttpSourceError(
    response.status,
    'http_error',
    response.statusText === ''
      ? `Request failed with status ${response.status}`
      : response.statusText,
  )
}
