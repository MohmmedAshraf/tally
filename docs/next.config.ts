import { createMDX } from 'fumadocs-mdx/next'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
}

const withMDX = createMDX()

export default withMDX(config)
