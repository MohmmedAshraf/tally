import { fileURLToPath } from 'node:url'
import { getRequestListener } from '@hono/node-server'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createPlaygroundHandler } from './server/tally.ts'

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

function tallyServer(): Plugin {
  return {
    name: 'tally-server',
    async configureServer(server) {
      const listener = getRequestListener(await createPlaygroundHandler(), {
        errorHandler: (error) => {
          server.config.logger.error(
            error instanceof Error ? (error.stack ?? error.message) : String(error),
          )
          return new Response(null, { status: 500 })
        },
      })
      server.middlewares.use('/api/tally', (request, response) => {
        void listener(request, response)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tallyServer()],
  resolve: {
    alias: {
      '@': source('./src'),
      'tally-react/styles.css': source('../../packages/react/src/styles.css'),
      'tally-react/fonts.css': source('../../packages/react/src/fonts.css'),
      'tally-react': source('../../packages/react/src/index.ts'),
      'tally-adapters': source('../../packages/adapters/src/index.ts'),
      'tally-protocol': source('../../packages/protocol/src/index.ts'),
      'tally-core/import': source('../../packages/core/src/import/index.ts'),
      'tally-core': source('../../packages/core/src/index.ts'),
    },
  },
  server: { port: 5180, strictPort: true },
})
