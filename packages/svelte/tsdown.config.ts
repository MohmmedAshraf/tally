import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  unbundle: true,
  dts: true,
  clean: true,
})

export default config
