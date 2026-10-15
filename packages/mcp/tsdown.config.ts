import { defineConfig, type UserConfig } from 'tsdown'
import { GUIDE_SOURCES } from './src/guides.ts'

const config: UserConfig = defineConfig({
  entry: { index: 'src/index.ts', bin: 'src/bin.ts' },
  format: 'esm',
  platform: 'node',
  fixedExtension: false,
  dts: { entry: ['src/index.ts'] },
  clean: true,
  copy: Object.entries(GUIDE_SOURCES).map(([name, from]) => ({
    from,
    to: 'dist/guides',
    rename: `${name}.md`,
  })),
})

export default config
