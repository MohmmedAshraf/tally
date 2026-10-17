import { defineConfig, type ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    name: 'vue',
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
  },
})

export default config
