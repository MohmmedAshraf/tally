import { createSchema } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { designColumn } from './design.ts'
import { promptText, scriptedModel } from './testing.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'risk', label: 'Risk' },
  ],
})

describe('designColumn', () => {
  it('turns a prompt into a computed column and an instruction', async () => {
    const scripted = scriptedModel([
      {
        id: 'risk',
        label: 'Churn risk',
        type: 'enum',
        options: [
          { value: 'low', label: 'Low', tone: 'green' },
          { value: 'high', label: 'High', tone: 'red' },
        ],
        instruction: 'Rate the churn risk from growth and health.',
      },
    ])
    const design = await designColumn('Churn risk, low or high', { model: scripted.model, schema })
    expect(design.column).toMatchObject({
      id: 'risk_2',
      label: 'Churn risk',
      type: 'enum',
      ai: true,
      filterable: false,
      sortable: false,
      groupable: false,
    })
    expect(design.column.options?.map((option) => option.value)).toEqual(['low', 'high'])
    expect(design.column.options?.[1]?.color).toBe('oklch(0.6 0.19 25)')
    expect(design.instruction).toBe('Rate the churn risk from growth and health.')
    expect(promptText(scripted.calls[0]!)).toContain('- account (text): Account')
  })

  it('drops options for plain types and forwards the abort signal', async () => {
    const scripted = scriptedModel([
      { id: 'summary', label: 'Summary', type: 'text', options: null, instruction: 'Summarize.' },
    ])
    const controller = new AbortController()
    const design = await designColumn('A summary', {
      model: scripted.model,
      schema,
      signal: controller.signal,
    })
    expect(design.column.id).toBe('summary')
    expect(design.column).not.toHaveProperty('options')
    expect(scripted.calls[0]?.abortSignal).toBe(controller.signal)
  })

  it('drops an empty option list on enum columns', async () => {
    const scripted = scriptedModel([
      { id: 'tier', label: 'Tier', type: 'enum', options: [], instruction: 'Tier.' },
    ])
    const design = await designColumn('Tier', { model: scripted.model, schema })
    expect(design.column).not.toHaveProperty('options')
  })
})
