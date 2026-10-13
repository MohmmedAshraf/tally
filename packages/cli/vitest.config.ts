import { defineConfig, type ViteUserConfig } from 'vitest/config'
const config: ViteUserConfig = defineConfig({
  test: {
    name: 'cli',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
export default config
