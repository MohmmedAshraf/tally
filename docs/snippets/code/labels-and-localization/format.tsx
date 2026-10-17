import type { ReactNode } from 'react'
import { createFormatContext, type DataSource, type Schema } from 'tally-core'
import { Tally, useGrid } from 'tally-react'

const format = createFormatContext({
  locale: 'ar-EG',
  timeZone: 'Africa/Cairo',
  numberingSystem: 'arab',
})

export function Accounts({ schema, source }: { schema: Schema; source: DataSource }): ReactNode {
  const grid = useGrid({ schema, source, format })
  return <Tally grid={grid} label="الحسابات" dir="rtl" />
}
