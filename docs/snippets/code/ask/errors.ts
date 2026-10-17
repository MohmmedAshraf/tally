import { AskError, ask, type AskOptions } from 'tally-ai'

export async function askOrExplain(question: string, options: AskOptions): Promise<string> {
  try {
    return (await ask(question, options)).text
  } catch (error) {
    if (error instanceof AskError) {
      return error.attempts.flatMap((attempt) => attempt.errors).join('\n')
    }
    throw error
  }
}
