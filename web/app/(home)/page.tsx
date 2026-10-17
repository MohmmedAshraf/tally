import type { ReactNode } from 'react'
import { docsUrl, githubUrl, playgroundUrl } from '@/lib/links'

const description =
  'The data grid with a query language, saved views and a backend protocol. Typed columns, grouping, live rows, undo, cards on phones, AI that writes real queries, and an MCP server so your coding agent knows where every change goes.'

const install = 'npm install tally-react tally-core react react-dom'

export default function HomePage(): ReactNode {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Tally</h1>
      <p className="text-neutral-600 dark:text-neutral-400">{description}</p>
      <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <code>{install}</code>
      </pre>
      <nav className="flex gap-4 text-sm font-medium">
        <a href={docsUrl} className="underline underline-offset-4">
          Documentation
        </a>
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
