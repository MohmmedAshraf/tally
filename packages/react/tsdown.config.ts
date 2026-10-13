import { defineConfig, type UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  dts: true,
  clean: true,
  copy: ['src/styles.css', 'src/fonts.css'],
})

export default config
