import { useMemo } from 'react'
import { compileFilter, condition, type FormatRule, type Grid, type RowData } from 'tally-core'

export interface CompiledRule {
  readonly rule: FormatRule
  matches(row: RowData): boolean
}

export function useCompiledRules(
  grid: Grid,
  rules: readonly FormatRule[],
): readonly CompiledRule[] {
  return useMemo(
    () =>
      rules.map((rule) => ({
        rule,
        matches: compileFilter(
          condition(rule.column, rule.op, rule.value),
          grid.schema,
          grid.context,
        ),
      })),
    [grid, rules],
  )
}

export function ruleFor(
  compiled: readonly CompiledRule[],
  column: string,
  row: RowData,
): FormatRule | undefined {
  for (const entry of compiled) {
    if (entry.rule.column === column && entry.matches(row)) return entry.rule
  }
  return undefined
}
