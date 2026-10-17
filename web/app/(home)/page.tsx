import type { ReactNode } from 'react'
import { Nav } from '@/components/nav'
import { Adapters } from '@/components/sections/adapters'
import { AiColumns } from '@/components/sections/ai-columns'
import { Ask } from '@/components/sections/ask'
import { ColumnTypes } from '@/components/sections/column-types'
import { Film } from '@/components/sections/film'
import { GroupBy } from '@/components/sections/group'
import { Hero } from '@/components/sections/hero'
import { Live } from '@/components/sections/live'
import { Mcp } from '@/components/sections/mcp'
import { Mobile } from '@/components/sections/mobile'
import { Outro } from '@/components/sections/outro'
import { Protocol } from '@/components/sections/protocol'
import { Query } from '@/components/sections/query'
import { Theming } from '@/components/sections/theming'
import { Undo } from '@/components/sections/undo'

export default function HomePage(): ReactNode {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Film />
        <Ask />
        <Query />
        <AiColumns />
        <Live />
        <Mcp />
        <Protocol />
        <Adapters />
        <ColumnTypes />
        <Undo />
        <GroupBy />
        <Mobile />
        <Theming />
        <Outro />
      </main>
    </>
  )
}
