import { generateText, Output, type LanguageModel, type ModelMessage } from 'ai'
import { parseQuery, printQuery, type Query, type Schema } from 'tally-core'
import { z } from 'zod'
import { describeSchema, type PromptOptions } from './prompt.ts'

export interface AskOptions extends PromptOptions {
  readonly model: LanguageModel
  readonly schema: Schema
  readonly repairs?: number | undefined
  readonly signal?: AbortSignal | undefined
}

export interface AskResult {
  readonly query: Query
  readonly text: string
  readonly explanation: string
}

export interface AskAttempt {
  readonly text: string
  readonly errors: readonly string[]
}

export class AskError extends Error {
  readonly question: string
  readonly attempts: readonly AskAttempt[]

  constructor(question: string, attempts: readonly AskAttempt[]) {
    const last = attempts.at(-1)
    super(last?.errors[0] ?? 'The model returned no query')
    this.name = 'AskError'
    this.question = question
    this.attempts = attempts
  }
}

const answerSchema = z.object({
  query: z.string().describe('The Tally query text'),
  explanation: z.string().describe('One short sentence telling the user what the query shows'),
})

function repairMessage(errors: readonly string[]): string {
  return `That query failed to parse:\n${errors.map((error) => `- ${error}`).join('\n')}\nReply with a corrected query.`
}

async function attempt(
  question: string,
  options: AskOptions,
  system: string,
  messages: readonly ModelMessage[],
  attempts: readonly AskAttempt[],
  remaining: number,
): Promise<AskResult> {
  const { output } = await generateText({
    model: options.model,
    system,
    messages: [...messages],
    output: Output.object({ schema: answerSchema }),
    ...(options.signal === undefined ? {} : { abortSignal: options.signal }),
  })
  const text = output.query.trim()
  const parsed = parseQuery(text, options.schema)
  const errors = text === '' ? ['The query is empty'] : parsed.errors.map((error) => error.message)
  if (errors.length === 0) {
    return {
      query: parsed.query,
      text: printQuery(parsed.query, options.schema),
      explanation: output.explanation.trim(),
    }
  }
  const failed = [...attempts, { text, errors }]
  if (remaining === 0) throw new AskError(question, failed)
  return attempt(
    question,
    options,
    system,
    [
      ...messages,
      { role: 'assistant', content: JSON.stringify(output) },
      { role: 'user', content: repairMessage(errors) },
    ],
    failed,
    remaining - 1,
  )
}

export function ask(question: string, options: AskOptions): Promise<AskResult> {
  const system = describeSchema(options.schema, options)
  return attempt(
    question,
    options,
    system,
    [{ role: 'user', content: question }],
    [],
    options.repairs ?? 1,
  )
}

export type AskHandler = (question: string, grid: { readonly schema: Schema }) => Promise<AskResult>

export function createAskHandler(options: Omit<AskOptions, 'schema'>): AskHandler {
  return (question, grid) => ask(question, { ...options, schema: grid.schema })
}
