<script lang="ts">
  import { untrack } from 'svelte'
  import type { DataSource, FormatContext, Schema } from 'tally-core'
  import { setGridContext, useGrid, type ReactiveGrid } from '../index.ts'
  import Status from './status.svelte'

  interface Props {
    source: DataSource
    schema: Schema
    pageSize?: number
    format?: FormatContext
    onGrid?: (grid: ReactiveGrid) => void
  }

  let { source, schema, pageSize, format, onGrid }: Props = $props()
  const grid = useGrid(() => ({ schema, source, pageSize, format }))
  setGridContext(grid)
  untrack(() => onGrid)?.(grid)
</script>

<Status />
