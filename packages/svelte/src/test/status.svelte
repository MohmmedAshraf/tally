<script lang="ts">
  import { getGridContext, gridRows, gridSelection, gridState, gridView } from '../index.ts'

  const grid = getGridContext()
  const state = gridState(grid)
  const view = gridView(grid)
  const loaded = gridRows(grid)
  const selection = gridSelection(grid)
  const text = $derived(
    [
      state.current.status,
      loaded.current.rows.map((row) => String(row['id'])).join(','),
      view.current.sort[0]?.direction ?? '-',
      loaded.current.changed.size,
      selection.current.active?.row ?? '-',
    ].join(':'),
  )
</script>

<output>{text}</output>
