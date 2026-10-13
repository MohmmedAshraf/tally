import { describe, expect, it } from 'vitest'
import { fillSeries } from './fill.ts'

describe('fillSeries', () => {
  it('continues arithmetic number series and repeats otherwise', () => {
    expect(fillSeries([1, 3], 3, 'number')).toEqual([5, 7, 9])
    expect(fillSeries([10], 2, 'number')).toEqual([10, 10])
    expect(fillSeries([1, 2, 4], 2, 'number')).toEqual([1, 2])
    expect(fillSeries([1, null], 2, 'number')).toEqual([1, null])
  })

  it('steps dates by the detected interval', () => {
    expect(fillSeries(['2026-01-01', '2026-01-08'], 2, 'date')).toEqual([
      '2026-01-15',
      '2026-01-22',
    ])
    expect(fillSeries(['2026-01-31'], 1, 'date')).toEqual(['2026-01-31'])
  })

  it('cycles enum and text values', () => {
    expect(fillSeries(['a', 'b'], 5, 'enum')).toEqual(['a', 'b', 'a', 'b', 'a'])
    expect(fillSeries([], 3, 'text')).toEqual([])
    expect(fillSeries(['x'], 0, 'text')).toEqual([])
  })
})
