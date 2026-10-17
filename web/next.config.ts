import type { NextConfig } from 'next'
import { mintlifyDocsOrigin } from './lib/links.ts'

const config: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/u/**' },
    ],
  },
  rewrites: async () => [
    { source: '/docs', destination: `${mintlifyDocsOrigin}/docs` },
    { source: '/docs/:path*', destination: `${mintlifyDocsOrigin}/docs/:path*` },
  ],
}

export default config
