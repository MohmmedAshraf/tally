import solid from 'vite-plugin-solid'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  plugins: [solid()],
  test: {
    name: 'solid',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'happy-dom',
  },
})

export default config
