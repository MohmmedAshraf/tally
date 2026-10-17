import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { githubUrl, playgroundUrl } from '@/lib/links'
import { source } from '@/lib/source'

export default function HomePage(): ReactNode {
  const overview = source.getPage([])
  const install = source.getPage(['react'])?.data.install
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Tally</h1>
      <p className="text-fd-muted-foreground">{overview?.data.description}</p>
      {install === undefined ? null : <DynamicCodeBlock lang="sh" code={install} />}
      <nav className="flex gap-4 text-sm font-medium">
        <Link href="/docs" className="underline underline-offset-4">
          Documentation
        </Link>
        <a href={playgroundUrl} className="underline underline-offset-4">
          Playground
        </a>
        <a href={githubUrl} className="underline underline-offset-4">
          GitHub
        </a>
      </nav>
    </main>
  )
}
