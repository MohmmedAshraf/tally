import type { LanguageModelV4CallOptions } from '@ai-sdk/provider'
import { MockLanguageModelV4 } from 'ai/test'

export interface ScriptedModel {
  readonly model: MockLanguageModelV4
  readonly calls: LanguageModelV4CallOptions[]
}

export function scriptedModel(answers: readonly unknown[]): ScriptedModel {
  const calls: LanguageModelV4CallOptions[] = []
  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      calls.push(options)
      const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      })
    },
  })
  return { model, calls }
}

export function promptText(call: LanguageModelV4CallOptions): string {
  return call.prompt
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : message.content.map((part) => ('text' in part ? part.text : '')).join(''),
    )
    .join('\n')
}
