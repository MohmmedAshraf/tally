import { type CellRenderers } from 'tally-react'

export const renderers: CellRenderers = {
  currency: ({ value, text }) => (
    <span className="tally-text tally-mono" data-negative={typeof value === 'number' && value < 0}>
      {text}
    </span>
  ),
  bool: ({ value }) => (value === true ? 'Yes' : value === false ? 'No' : null),
  enum: ({ text, column }) => <span title={column.description}>{text}</span>,
}
