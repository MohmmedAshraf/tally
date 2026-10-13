import { defineConfig, type ViteUserConfig } from 'vitest/config'
const config: ViteUserConfig = defineConfig({
  test: {
    name: 'react',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'happy-dom',
  },
})
export default config
