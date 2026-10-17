import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { githubUrl, playgroundUrl } from './links'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Tally',
    },
    githubUrl,
    links: [{ text: 'Playground', url: playgroundUrl, external: true }],
  }
}
