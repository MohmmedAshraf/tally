import { defineConfig, type ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.bench.ts', '**/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      reporter: ['text', 'lcov'],
    },
  },
})

export default config
