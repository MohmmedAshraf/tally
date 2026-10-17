import { existsSync, readdirSync } from 'node:fs'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

const threshold = { lines: 90, functions: 90, branches: 85, statements: 90 }

const packages = readdirSync(new URL('./packages/', import.meta.url)).filter((name) =>
  existsSync(new URL(`./packages/${name}/vitest.config.ts`, import.meta.url)),
)

const config: ViteUserConfig = defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.bench.ts',
        '**/*.d.ts',
        '**/index.ts',
        'packages/*/src/test/**',
        'packages/*/src/testing.ts',
        'packages/mcp/src/bin.ts',
      ],
      thresholds: {
        ...threshold,
        ...Object.fromEntries(packages.map((name) => [`packages/${name}/src/**`, threshold])),
      },
      reporter: [['text', { skipFull: true }], 'lcov'],
    },
  },
})

export default config
