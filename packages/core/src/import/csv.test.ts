import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from '../types/builtin/index.ts'
import { importCsv, slugifyHeader } from './csv.ts'
import { detectColumnType } from './detect.ts'

const registry = createDefaultRegistry()

const sample = `city,Region,population,area_km2,last_census,capital,website,growth,contact,amount
Lisbon,Europe,545923,100.05,2021-03-19,yes,lisboa.pt,0.4%,info@lisboa.pt,$1200
Porto,Europe,231800,41.42,2021-03-19,no,porto.pt,-0.3%,geral@cm-porto.pt,$80.50
Osaka,Asia,"2,752,412",225.21,2020-10-01,no,city.osaka.lg.jp,-0.1%,info@city.osaka.jp,$3
Tokyo,Asia,13960000,2194.07,2020-10-01,yes,metro.tokyo.lg.jp,0.2%,contact@metro.tokyo.jp,$9
Nairobi,Africa,4397073,696.10,2019-08-24,yes,nairobi.go.ke,3.9%,info@nairobi.go.ke,$12
Lagos,Africa,15388000,1171.28,2006-03-21,no,lagosstate.gov.ng,3.2%,info@lagosstate.gov.ng,n/a
`

describe('detectColumnType', () => {
  it.each([
    [['yes', 'no', 'y'], 'bool'],
    [['a@b.co', 'c@d.org'], 'email'],
    [['tally.dev', 'https://x.io/a'], 'url'],
    [['2026-01-01', '2026-02-02'], 'date'],
    [['3%', '-4.5%'], 'percent'],
    [['$3', '$4,000.10'], 'currency'],
    [['1', '2,000', '3'], 'int'],
    [['1.5', '2', '3.25'], 'number'],
    [['a', 'b', 'a', 'b', 'a', 'b'], 'enum'],
    [['alpha', 'beta', 'gamma', 'delta'], 'text'],
    [[], 'text'],
  ])('detects %j as %s', (samples, expected) => {
    expect(detectColumnType(samples, registry).type).toBe(expected)
  })

  it('tolerates a quarter of bad values and reports confidence', () => {
    const result = detectColumnType(['1', '2', '3', 'x'], registry)
    expect(result).toEqual({ type: 'int', confidence: 0.75 })
    expect(detectColumnType(['1', '2', 'x', 'y'], registry).type).toBe('text')
  })
})

describe('importCsv', () => {
  const result = importCsv(sample)

  it('normalizes headers and detects types', () => {
    expect(result.columns.map((imported) => [imported.column.id, imported.column.type])).toEqual([
      ['city', 'text'],
      ['region', 'enum'],
      ['population', 'int'],
      ['area_km2', 'number'],
      ['last_census', 'date'],
      ['capital', 'bool'],
      ['website', 'url'],
      ['growth', 'percent'],
      ['contact', 'email'],
      ['amount', 'currency'],
    ])
    expect(result.columns[1]?.column.options).toEqual([
      { value: 'Africa' },
      { value: 'Asia' },
      { value: 'Europe' },
    ])
    expect(result.columns[1]?.column.label).toBe('Region')
    expect(result.delimiter).toBe(',')
  })

  it('coerces values and keeps invalid ones with issues', () => {
    expect(result.rows[2]).toMatchObject({
      city: 'Osaka',
      population: 2_752_412,
      area_km2: 225.21,
      capital: false,
      growth: -0.1,
      amount: 3,
      id: 3,
    })
    expect(result.issues).toEqual([
      { row: 5, column: 'amount', value: 'n/a', message: '"n/a" is not a valid currency' },
    ])
    expect(result.columns[9]?.invalid).toBe(1)
    expect(result.keyField).toBe('id')
    expect(result.columns[0]?.samples).toEqual(['Lisbon', 'Porto', 'Osaka'])
  })

  it('honours type overrides and other delimiters', () => {
    const overridden = importCsv(sample, { types: { population: 'text' } })
    expect(overridden.rows[0]?.['population']).toBe('545923')
    const tsv = importCsv('name\tscore\nA\t1\nB\t2\n')
    expect(tsv.delimiter).toBe('\t')
    expect(tsv.rows).toEqual([
      { name: 'A', score: 1, id: 1 },
      { name: 'B', score: 2, id: 2 },
    ])
  })

  it('uses an existing unique id column and falls back otherwise', () => {
    const unique = importCsv('id,name\n10,A\n20,B\n')
    expect(unique.keyField).toBe('id')
    expect(unique.rows).toEqual([
      { id: 10, name: 'A' },
      { id: 20, name: 'B' },
    ])
    const duplicate = importCsv('id,name\n1,A\n1,B\n')
    expect(duplicate.keyField).toBe('_key')
    expect(duplicate.rows[1]).toEqual({ id: 1, name: 'B', _key: 2 })
    const custom = importCsv('ref,name\nx,A\ny,B\n', { keyField: 'ref' })
    expect(custom.keyField).toBe('ref')
  })

  it('handles blank headers, duplicates and empty cells', () => {
    const odd = importCsv(',Name,name,\nx,,q,z\n')
    expect(odd.columns.map((imported) => imported.column.id)).toEqual([
      'column_1',
      'name',
      'name_2',
      'column_4',
    ])
    expect(odd.rows[0]).toEqual({ column_1: 'x', name: null, name_2: 'q', column_4: 'z', id: 1 })
    expect(slugifyHeader('  Área (km²) ', 0)).toBe('área_km²')
    expect(importCsv('').rows).toEqual([])
  })
})
