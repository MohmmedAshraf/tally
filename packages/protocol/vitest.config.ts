import { defineConfig, type ViteUserConfig } from 'vitest/config'
const config: ViteUserConfig = defineConfig({
  test: {
    name: 'protocol',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
export default config
