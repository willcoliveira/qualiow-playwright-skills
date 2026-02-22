import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/init.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist/bin',
  splitting: false,
  clean: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
