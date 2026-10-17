import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getMDXComponents } from '@/components/mdx'
import { source } from '@/lib/source'

interface Props {
  readonly params: Promise<{ slug?: string[] }>
}

export default async function Page({ params }: Props): Promise<ReactNode> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (page === undefined) notFound()
  const Body = page.data.body
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Body components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams(): ReturnType<typeof source.generateParams> {
  return source.generateParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (page === undefined) notFound()
  return {
    title: page.data.title,
    description: page.data.description,
  }
}
