import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './global.css'

export const metadata: Metadata = {
  title: {
    template: '%s | Tally',
    default: 'Tally',
  },
}

export default function Layout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  )
}
