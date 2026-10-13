import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'tally-react/styles.css': source('../../packages/react/src/styles.css'),
      'tally-react': source('../../packages/react/src/index.ts'),
      'tally-core/import': source('../../packages/core/src/import/index.ts'),
      'tally-core': source('../../packages/core/src/index.ts'),
    },
  },
  server: { port: 5180, strictPort: true },
})
