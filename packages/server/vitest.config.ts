import { defineConfig, type ViteUserConfig } from 'vitest/config'
const config: ViteUserConfig = defineConfig({
  test: {
    name: 'server',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
export default config
