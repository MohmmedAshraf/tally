import { createSchema } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { AskError, ask, createAskHandler } from './ask.ts'
import { promptText, scriptedModel } from './testing.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    {
      id: 'plan',
      label: 'Plan',
      type: 'enum',
      options: [
        { value: 'pro', label: 'Pro' },
        { value: 'team', label: 'Team' },
      ],
    },
    { id: 'mrr', label: 'MRR', type: 'currency' },
    { id: 'renewal', label: 'Renewal', type: 'date' },
  ],
})

describe('ask', () => {
  it('turns a question into a validated query', async () => {
    const scripted = scriptedModel([
      {
        query: 'plan is team and mrr > 2k sort by mrr desc',
        explanation: 'Team accounts over $2k',
      },
    ])
    const result = await ask('big team accounts', { model: scripted.model, schema })
    expect(result.query).toEqual({
      filter: {
        type: 'and',
        filters: [
          { type: 'condition', column: 'plan', op: 'eq', value: 'team' },
          { type: 'condition', column: 'mrr', op: 'gt', value: 2000 },
        ],
      },
      sort: [{ column: 'mrr', direction: 'desc' }],
    })
    expect(result.text).toBe('plan is team and mrr > 2000, sort by mrr desc')
    expect(result.explanation).toBe('Team accounts over $2k')
    expect(scripted.calls).toHaveLength(1)
    expect(promptText(scripted.calls[0]!)).toContain('big team accounts')
  })

  it('sends the schema description as the system prompt', async () => {
    const scripted = scriptedModel([{ query: 'plan is pro', explanation: '' }])
    await ask('pro plans', { model: scripted.model, schema, now: new Date('2026-10-14T12:00:00Z') })
    const system = scripted.calls[0]?.prompt[0]
    expect(system?.role).toBe('system')
    const text = promptText(scripted.calls[0]!)
    expect(text).toContain('- plan (enum): Plan')
    expect(text).toContain('values: pro (Pro), team (Team)')
    expect(text).toContain('Today is 2026-10-14.')
  })

  it('repairs a query that fails to parse', async () => {
    const scripted = scriptedModel([
      { query: 'plans is enterprise', explanation: 'first try' },
      { query: 'plan is pro', explanation: 'second try' },
    ])
    const result = await ask('enterprise', { model: scripted.model, schema })
    expect(result.text).toBe('plan is pro')
    expect(result.explanation).toBe('second try')
    expect(scripted.calls).toHaveLength(2)
    const repair = promptText(scripted.calls[1]!)
    expect(repair).toContain('plans is enterprise')
    expect(repair).toContain('failed to parse')
  })

  it('throws with every attempt when repairs run out', async () => {
    const scripted = scriptedModel([{ query: 'mrr >', explanation: '' }])
    const failure = await ask('broken', { model: scripted.model, schema, repairs: 2 }).catch(
      (error: unknown) => error,
    )
    if (!(failure instanceof AskError)) throw new Error('expected an AskError')
    expect(failure.attempts).toHaveLength(3)
    expect(failure.question).toBe('broken')
    expect(failure.message).toMatch(/expect/i)
  })

  it('rejects an empty query without applying it', async () => {
    const scripted = scriptedModel([{ query: '  ', explanation: 'nothing' }])
    await expect(ask('?', { model: scripted.model, schema, repairs: 0 })).rejects.toMatchObject({
      name: 'AskError',
      message: 'The query is empty',
    })
  })

  it('creates a handler that reads the schema from the grid', async () => {
    const scripted = scriptedModel([{ query: 'renewal last 30 days', explanation: 'Recent' }])
    const handler = createAskHandler({ model: scripted.model })
    const result = await handler('renewed recently', { schema })
    expect(result.query.filter).toMatchObject({ column: 'renewal', op: 'within' })
  })
})
