import {
  computed,
  inject,
  provide,
  toValue,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
} from 'vue'
import { TallyError, type Grid } from 'tally-core'

const gridKey: InjectionKey<ComputedRef<Grid>> = Symbol('tally-grid')

export function provideGrid(grid: MaybeRefOrGetter<Grid>): void {
  provide(
    gridKey,
    computed(() => toValue(grid)),
  )
}

export function injectGrid(): ComputedRef<Grid> {
  const grid = inject(gridKey, undefined)
  if (grid === undefined) {
    throw new TallyError('invalid_value', 'injectGrid must be used below provideGrid')
  }
  return grid
}
