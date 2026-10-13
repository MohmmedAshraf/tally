import { describe, expect, it } from 'vitest'
import { createFormatContext } from '../../format/context.ts'
import type { Column } from '../../schema/column.ts'
import { builtinTypes, createDefaultRegistry } from './index.ts'

const context = createFormatContext()
const registry = createDefaultRegistry()

function column(type: string, extra: Partial<Column> = {}): Column {
  return { id: 'c', type, ...extra }
}

describe('registry', () => {
  it('registers all fourteen built-in types', () => {
    expect(registry.names()).toEqual([
      'text',
      'enum',
      'currency',
      'int',
      'number',
      'percent',
      'bar',
      'date',
      'bool',
      'email',
      'url',
      'id',
      'person',
      'duration',
    ])
    expect(builtinTypes).toHaveLength(14)
  })

  it('rejects duplicates and unknown names', () => {
    expect(() => registry.register(registry.get('text'))).toThrow('already registered')
    expect(() => registry.get('nope')).toThrow('Unknown column type')
    expect(registry.has('date')).toBe(true)
  })

  it('every type parses what it formats', () => {
    const samples: Record<string, unknown> = {
      text: 'Acme',
      enum: 'pro',
      currency: 1234.5,
      int: 42,
      number: 3.25,
      percent: 12.5,
      bar: 80,
      date: '2026-10-13',
      bool: true,
      email: 'a@b.co',
      url: 'https://tally.dev',
      id: 'TX-1',
      person: 'Ada',
      duration: 95,
    }
    const roundTrips = builtinTypes.map((type) => {
      const col = column(type.name, { options: [{ value: 'pro', label: 'Pro' }] })
      const value = samples[type.name]
      if (!type.is(value)) return { name: type.name, parsed: undefined }
      return { name: type.name, parsed: type.parse(type.format(value, col, context), col) }
    })
    for (const result of roundTrips) {
      expect(result.parsed).toBeDefined()
    }
  })
})

describe('text family', () => {
  it('trims and rejects empty', () => {
    const text = registry.get('text')
    expect(text.parse('  hi ', column('text'))).toBe('hi')
    expect(text.parse('', column('text'))).toBeUndefined()
    expect(text.parse(12, column('text'))).toBe('12')
    expect(text.parse(null, column('text'))).toBeUndefined()
  })

  it('sorts naturally with the locale collator', () => {
    const text = registry.get('text')
    const col = column('text')
    expect(text.compare('file2', 'file10', col, context)).toBeLessThan(0)
    expect(text.compare('b', 'A', col, context)).toBeGreaterThan(0)
  })

  it('detects emails and urls', () => {
    expect(registry.get('email').detect?.('info@lisboa.pt')).toBe(true)
    expect(registry.get('email').detect?.('lisboa.pt')).toBe(false)
    expect(registry.get('url').detect?.('city.osaka.lg.jp')).toBe(true)
    expect(registry.get('url').detect?.('hello world')).toBe(false)
    expect(registry.get('email').jsonSchema(column('email'))).toEqual({
      type: 'string',
      format: 'email',
    })
  })

  it('person matches a known option but keeps free text', () => {
    const person = registry.get('person')
    const col = column('person', { options: [{ value: 'Ada Okafor' }, { value: 'Bruno Silva' }] })
    expect(person.parse('ada', col)).toBe('Ada Okafor')
    expect(person.parse('Zed', col)).toBe('Zed')
    expect(person.groupable).toBe(true)
  })
})

describe('enum', () => {
  const col = column('enum', {
    options: [
      { value: 'active', label: 'Active' },
      { value: 'past_due', label: 'Past due' },
      { value: 'churned', label: 'Churned' },
    ],
  })
  const type = registry.get('enum')

  it('matches by value, label, prefix and word', () => {
    expect(type.parse('Past due', col)).toBe('past_due')
    expect(type.parse('past', col)).toBe('past_due')
    expect(type.parse('due', col)).toBe('past_due')
    expect(type.parse('CHURNED', col)).toBe('churned')
    expect(type.parse('gone', col)).toBeUndefined()
  })

  it('formats labels and sorts by option order', () => {
    expect(type.format('past_due', col, context)).toBe('Past due')
    expect(type.compare('active', 'churned', col, context)).toBeLessThan(0)
    expect(type.compare('zzz', 'active', col, context)).toBeGreaterThan(0)
    expect(type.jsonSchema(col)).toEqual({
      type: 'string',
      enum: ['active', 'past_due', 'churned'],
    })
  })
})

describe('number family', () => {
  it('formats number, int, currency and percent', () => {
    expect(registry.get('number').format(1234.567, column('number'), context)).toBe('1,234.57')
    expect(
      registry
        .get('number')
        .format(1234.567, column('number', { format: { fractionDigits: 0 } }), context),
    ).toBe('1,235')
    expect(
      registry.get('int').format(1234.4, column('int', { format: { suffix: ' pt' } }), context),
    ).toBe('1,234 pt')
    expect(registry.get('currency').format(-1200, column('currency'), context)).toBe('-$1,200.00')
    expect(
      registry
        .get('currency')
        .format(
          1200,
          column('currency', { format: { currency: 'EUR', fractionDigits: 0 } }),
          createFormatContext({ locale: 'de-DE' }),
        ),
    ).toBe('1.200\u00A0€')
    expect(
      registry
        .get('currency')
        .format(1_500_000, column('currency', { format: { compact: true } }), context),
    ).toBe('$1.5M')
    expect(registry.get('percent').format(12.345, column('percent'), context)).toBe('12.3%')
    expect(
      registry.get('percent').format(4, column('percent', { format: { signed: true } }), context),
    ).toBe('+4.0%')
  })

  it('parses and coerces', () => {
    expect(registry.get('int').parse('1,250.7', column('int'))).toBe(1251)
    expect(registry.get('bar').parse('140', column('bar'))).toBe(100)
    expect(registry.get('bar').parse('-3', column('bar'))).toBe(0)
    expect(registry.get('percent').parse('12%', column('percent'))).toBe(12)
    expect(registry.get('currency').parse('$2k', column('currency'))).toBe(2000)
    expect(registry.get('number').parse('abc', column('number'))).toBeUndefined()
  })

  it('detects numeric samples', () => {
    expect(registry.get('currency').detect?.('$1,200.50')).toBe(true)
    expect(registry.get('percent').detect?.('-0.3%')).toBe(true)
    expect(registry.get('int').detect?.('13,960,000')).toBe(true)
    expect(registry.get('int').detect?.('13.5')).toBe(false)
    expect(registry.get('number').detect?.('100.05')).toBe(true)
  })

  it('handles durations', () => {
    const duration = registry.get('duration')
    const col = column('duration')
    expect(duration.parse('1m 30s', col)).toBe(90)
    expect(duration.parse('1:05', col)).toBe(65)
    expect(duration.parse('1:02:03', col)).toBe(3723)
    expect(duration.parse('2h', col)).toBe(7200)
    expect(duration.parse('45', col)).toBe(45)
    expect(duration.parse('-5', col)).toBe(0)
    expect(duration.format(45, col, context)).toBe('45s')
    expect(duration.format(95, col, context)).toBe('1m 35s')
    expect(duration.format(3720, col, context)).toBe('1h 2m')
    expect(
      duration.format(
        90_000,
        column('duration', { format: { durationUnit: 'milliseconds' } }),
        context,
      ),
    ).toBe('1m 30s')
  })
})

describe('date', () => {
  const type = registry.get('date')

  it('parses, formats and compares iso dates', () => {
    expect(type.parse('2026-10-13T10:00:00Z', column('date'))).toBe('2026-10-13')
    expect(type.format('2026-10-13', column('date'), context)).toBe('Oct 13, 2026')
    expect(
      type.format('2026-10-13', column('date', { format: { dateStyle: 'short' } }), context),
    ).toBe('10/13/2026')
    expect(
      type.format('2026-10-13', column('date', { format: { dateStyle: 'long' } }), context),
    ).toBe('October 13, 2026')
    expect(type.compare('2026-01-01', '2025-12-31', column('date'), context)).toBe(1)
    expect(type.is('2026-02-30')).toBe(false)
    expect(type.detect?.('2026-02-28')).toBe(true)
  })
})

describe('bool', () => {
  const type = registry.get('bool')

  it('parses common spellings', () => {
    const col = column('bool')
    expect(type.parse('yes', col)).toBe(true)
    expect(type.parse('N', col)).toBe(false)
    expect(type.parse(1, col)).toBe(true)
    expect(type.parse('maybe', col)).toBeUndefined()
    expect(type.format(true, col, context)).toBe('true')
    expect(type.compare(false, true, col, context)).toBe(-1)
  })
})
