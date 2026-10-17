import { useState, type ReactNode } from 'react'
import { createArraySource, createFormatContext, type RowData, type Schema } from 'tally-core'
import { Tally, useGrid } from 'tally-react'

const format = createFormatContext({ locale: 'ar-EG', numberingSystem: 'arab' })

export function Accounts({ rows, schema }: { rows: RowData[]; schema: Schema }): ReactNode {
  const [source] = useState(() => createArraySource(rows, schema))
  const grid = useGrid({ schema, source, format })
  return (
    <Tally
      grid={grid}
      dir="rtl"
      label="الحسابات"
      labels={{ filterPlaceholder: 'تصفية…', rows: (count) => `${count} صف` }}
    />
  )
}
