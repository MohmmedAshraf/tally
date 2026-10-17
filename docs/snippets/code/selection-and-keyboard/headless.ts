import { emptySelection, keyboardIntent, reduceSelection, type GridGeometry } from 'tally-core'

const geometry: GridGeometry = {
  rowCount: 100,
  columnCount: 6,
  pageSize: 20,
  rowKeyAt: (index) => index,
}

const intent = keyboardIntent({ key: 'ArrowDown', shiftKey: true }, emptySelection, geometry)

export const selection =
  intent?.type === 'select'
    ? reduceSelection(emptySelection, intent.action, geometry)
    : emptySelection
