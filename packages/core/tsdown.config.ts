import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: { index: 'src/index.ts', import: 'src/import/index.ts' },
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
})

export default config
