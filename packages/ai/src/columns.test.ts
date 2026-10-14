import { createArraySource, createSchema, type RowPatch } from 'tally-core'
import { describe, expect, it } from 'vitest'
import { withAiColumns } from './columns.ts'
import { promptText, scriptedModel } from './testing.ts'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'notes', label: 'Notes' },
    {
      id: 'mood',
      label: 'Mood',
      type: 'enum',
      options: [{ value: 'happy' }, { value: 'unhappy' }],
      filterable: false,
      sortable: false,
      groupable: false,
    },
  ],
})

const rows = [
  { id: 1, account: 'Acme', notes: 'Loves the product' },
  { id: 2, account: 'Globex', notes: 'Threatening to churn' },
  { id: 3, account: 'Initech', notes: '' },
]

describe('withAiColumns', () => {
  it('fills the column through live patches and caches the values', async () => {
    const scripted = scriptedModel([
      {
        results: [
          { key: '1', value: 'happy' },
          { key: '2', value: 'unhappy' },
          { key: '3', value: null },
        ],
      },
    ])
    const source = withAiColumns(createArraySource(rows, schema), schema, [
      { column: 'mood', model: scripted.model, instruction: 'Judge the mood from the notes.' },
    ])
    const patches: RowPatch[] = []
    source.subscribe((patch) => patches.push(patch))
    const first = await source.query({ version: 1, sort: [] })
    expect(first.rows.map((row) => row['mood'])).toEqual([undefined, undefined, undefined])
    expect(source.pending('mood')).toEqual(new Set([1, 2, 3]))
    await source.idle()
    expect(source.pending()).toEqual(new Set())
    expect(patches).toHaveLength(1)
    expect(patches[0]?.upserts?.map((row) => row['mood'])).toEqual(['happy', 'unhappy', null])
    const prompt = promptText(scripted.calls[0]!)
    expect(prompt).toContain('Judge the mood from the notes.')
    expect(prompt).toContain('exactly one of: happy, unhappy')
    expect(prompt).toContain('{"key":"2","account":"Globex","notes":"Threatening to churn"}')
    const second = await source.query({ version: 1, sort: [] })
    expect(second.rows.map((row) => row['mood'])).toEqual(['happy', 'unhappy', null])
    expect(scripted.calls).toHaveLength(1)
  })

  it('keeps computed values on incoming patches and recomputes when inputs change', async () => {
    const scripted = scriptedModel([
      { results: [{ key: '1', value: 'happy' }] },
      { results: [{ key: '1', value: 'unhappy' }] },
    ])
    const inner = createArraySource(rows.slice(0, 1), schema)
    const source = withAiColumns(inner, schema, [
      {
        column: 'mood',
        model: scripted.model,
        instruction: 'Judge the mood.',
        inputs: ['notes'],
      },
    ])
    const patches: RowPatch[] = []
    source.subscribe((patch) => patches.push(patch))
    await source.query({ version: 1, sort: [] })
    await source.idle()
    inner.patch({ upserts: [{ id: 1, account: 'Acme Corp', notes: 'Loves the product' }] })
    expect(patches.at(-1)?.upserts?.[0]).toMatchObject({ account: 'Acme Corp', mood: 'happy' })
    expect(scripted.calls).toHaveLength(1)
    inner.patch({ upserts: [{ id: 1, account: 'Acme Corp', notes: 'Cancelled' }] })
    expect(patches.at(-1)?.upserts?.[0]?.['mood']).toBeUndefined()
    await source.idle()
    expect(patches.at(-1)?.upserts?.[0]?.['mood']).toBe('unhappy')
    expect(scripted.calls).toHaveLength(2)
  })

  it('splits work into batches and bounds concurrency', async () => {
    const scripted = scriptedModel([{ results: [] }])
    const many = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, account: `A${index}` }))
    const source = withAiColumns(createArraySource(many, schema), schema, [
      { column: 'mood', model: scripted.model, instruction: 'x', batchSize: 3, concurrency: 1 },
    ])
    await source.query({ version: 1, sort: [] })
    await source.idle()
    expect(scripted.calls).toHaveLength(3)
    expect(
      promptText(scripted.calls[0]!)
        .split('\n')
        .filter((line) => line.startsWith('{"key"')),
    ).toHaveLength(3)
  })

  it('refuses columns that are filterable, sortable or groupable', () => {
    const loose = createSchema({ columns: [{ id: 'id' }, { id: 'summary' }] })
    expect(() =>
      withAiColumns(createArraySource([], loose), loose, [
        { column: 'summary', model: scriptedModel([]).model, instruction: 'x' },
      ]),
    ).toThrow('must set filterable, sortable and groupable to false')
  })
})
