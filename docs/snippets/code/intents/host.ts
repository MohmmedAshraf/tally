import { keyboardIntent, type Grid, type GridIntent } from 'tally-core'

export function handleKey(grid: Grid, event: KeyboardEvent): GridIntent | undefined {
  const intent = keyboardIntent(
    {
      key: event.key,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
    },
    grid.selection.get(),
    grid.selection.geometry(),
    { platform: /mac/i.test(navigator.platform) ? 'mac' : 'other' },
  )
  if (intent?.type === 'select') grid.selection.dispatch(intent.action)
  return intent
}
