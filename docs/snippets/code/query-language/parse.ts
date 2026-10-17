import { createSchema, execute, parseQuery, printQuery } from 'tally-core'

const schema = createSchema({
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'plan', type: 'enum', options: [{ value: 'free' }, { value: 'pro' }, { value: 'team' }] },
    { id: 'mrr', label: 'MRR', type: 'currency' },
  ],
})

const { query, errors } = parseQuery('plan is pro or team, sort by mrr', schema)

export const text = printQuery(query, schema)
export const problems = errors.map((error) => `${error.message} at ${error.offset}`)
export const result = execute([{ id: 1, account: 'Acme', plan: 'pro', mrr: 4200 }], query, schema)
