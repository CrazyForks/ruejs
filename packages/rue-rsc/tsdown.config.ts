import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/plugin.ts',
    'src/browser.ts',
    'src/ssr.tsx',
    'src/rsc.tsx',
    'src/core/browser.ts',
    'src/core/payload.ts',
    'src/core/ssr.ts',
    'src/core/rsc.ts',
    'src/transforms/index.ts',
    'src/plugins/cjs.ts',
    'src/utils/rpc.ts',
    'src/utils/encryption-runtime.ts',
  ],
  format: ['esm'],
  // TODO: specify explicitly
  inlineOnly: false,
  fixedExtension: false,
  external: [/^virtual:/],
  dts: {
    sourcemap: process.argv.slice(2).includes('--sourcemap'),
  },
}) as any
