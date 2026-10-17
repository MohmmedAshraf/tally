import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    name: 'svelte',
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
  },
})

export default config
