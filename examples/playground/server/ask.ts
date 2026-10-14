import { createAnthropic } from '@ai-sdk/anthropic'
import { AskError, ask } from 'tally-ai'
import { datasetById } from '../src/datasets/index.ts'

const DEFAULT_MODEL = 'claude-sonnet-5-5'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export function createAskRoute(): (request: Request) => Promise<Response> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  const model =
    apiKey === undefined || apiKey === ''
      ? undefined
      : createAnthropic({ apiKey })(process.env['TALLY_ASK_MODEL'] ?? DEFAULT_MODEL)
  return async (request) => {
    if (request.method === 'GET') return json({ available: model !== undefined })
    if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405)
    if (model === undefined) return json({ message: 'Ask is not configured' }, 503)
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null) return json({ message: 'Invalid body' }, 400)
    const { dataset: id, question } = body as { dataset?: unknown; question?: unknown }
    if (typeof id !== 'string' || typeof question !== 'string') {
      return json({ message: 'Invalid body' }, 400)
    }
    const dataset = datasetById(id)
    try {
      const result = await ask(question, {
        model,
        schema: dataset.schema,
        examples: dataset.examples,
      })
      return json({ text: result.text, explanation: result.explanation })
    } catch (error: unknown) {
      if (error instanceof AskError) {
        return json({ message: error.message, attempts: error.attempts }, 422)
      }
      throw error
    }
  }
}
