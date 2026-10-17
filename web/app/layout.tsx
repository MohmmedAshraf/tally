import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Onest } from 'next/font/google'
import type { ReactNode } from 'react'
import { MotionProvider } from '@/components/motion-provider'
import { siteUrl } from '@/lib/links'
import './global.css'

const onest = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' })

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const description =
  'The data grid with a query language, saved views and a backend protocol. Typed columns, grouping, live rows, undo, cards on phones, AI that writes real queries, and an MCP server so your coding agent knows where every change goes.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Tally',
  description,
  openGraph: { title: 'Tally', description, url: siteUrl, siteName: 'Tally', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Tally', description },
}

export const viewport: Viewport = {
  themeColor: '#f4f5f8',
}

export default function Layout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en" className={`${onest.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
