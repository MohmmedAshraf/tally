<script setup lang="ts">
import { createArraySource, createSchema } from 'tally-core'
import { useGrid, useGridState, useView } from 'tally-vue'

const props = defineProps<{ rows: Account[] }>()

const schema = createSchema({
  key: 'id',
  columns: [
    { id: 'account', label: 'Account' },
    { id: 'mrr', label: 'MRR', type: 'currency', aggregate: 'sum' },
  ],
})
const source = createArraySource(props.rows, schema)

const grid = useGrid({ schema, source })
const state = useGridState(grid)
const view = useView(grid)
</script>

<template>
  <p>{{ state.status }}, sorted by {{ view.sort[0]?.column ?? 'nothing' }}</p>
  <button @click="grid.view.toggleSort('mrr')">Sort by MRR</button>
</template>
