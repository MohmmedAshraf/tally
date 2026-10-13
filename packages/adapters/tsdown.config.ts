import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts', 'src/query.ts', 'src/db.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
})

export default config
