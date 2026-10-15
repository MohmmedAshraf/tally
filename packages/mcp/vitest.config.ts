import { defineConfig, type ViteUserConfig } from 'vitest/config'
const config: ViteUserConfig = defineConfig({
  test: {
    name: 'mcp',
    include: ['src/**/*.test.ts'],
  },
})
export default config
