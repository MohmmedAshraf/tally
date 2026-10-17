import {
  computed,
  toRaw,
  toValue,
  watchPostEffect,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { holdGrid, type Grid, type GridOptions, type HeldGrid } from 'tally-core'

export function useGrid(options: MaybeRefOrGetter<GridOptions>): ComputedRef<Grid> {
  const held = computed<HeldGrid>((previous) => {
    const next = toValue(options)
    return holdGrid({ ...next, schema: toRaw(next.schema), source: toRaw(next.source) }, previous)
  })
  watchPostEffect((onCleanup) => {
    const { grid } = held.value
    void grid.load()
    onCleanup(() => grid.dispose())
  })
  return computed(() => held.value.grid)
}
