import path from 'node:path'
import { defineConfig } from 'vite-plus'

const textRuntimeVirtualModules = [
  'private-text-instrumentation-client',
  'virtual:text-rsc-entry',
  'virtual:text-rsc/client-references',
]

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify('test'),
  },
  test: {
    pool: 'forks',
    maxWorkers: 2,
    execArgv: ['--max-old-space-size=8192'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    teardownTimeout: 60_000,
  },
  resolve: {
    alias: [
      { find: /^text\/head$/, replacement: path.resolve(import.meta.dirname, 'src/shims/head.ts') },
      {
        find: /^text\/image$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/image.tsx'),
      },
      {
        find: /^text\/legacy\/image$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/legacy-image.tsx'),
      },
      {
        find: /^text\/router$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/router.ts'),
      },
      {
        find: /^text\/compat\/router$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/compat-router.ts'),
      },
      {
        find: /^text\/headers$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/headers.ts'),
      },
      {
        find: /^text\/server$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/server.ts'),
      },
      {
        find: /^text\/dynamic$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/dynamic.ts'),
      },
      {
        find: /^text\/config$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/config.ts'),
      },
      {
        find: /^text\/script$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/script.tsx'),
      },
      {
        find: /^text\/font\/google$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/font-google.ts'),
      },
      {
        find: /^text\/font\/local$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/font-local.ts'),
      },
      { find: /^text\/og$/, replacement: path.resolve(import.meta.dirname, 'src/shims/og.tsx') },
      {
        find: /^text\/constants$/,
        replacement: path.resolve(import.meta.dirname, 'src/shims/constants.ts'),
      },
      { find: /^text\/(.+)$/, replacement: path.resolve(import.meta.dirname, 'src/$1') },
      { find: 'text', replacement: path.resolve(import.meta.dirname, 'src/index.ts') },
      {
        find: '@rue-js/jsx-runtime',
        replacement: path.resolve(import.meta.dirname, 'src/shims/jsx-runtime-compat.ts'),
      },
      {
        find: '@rue-js/jsx-dev-runtime',
        replacement: path.resolve(import.meta.dirname, 'src/shims/jsx-dev-runtime-compat.ts'),
      },
      {
        find: '@rue-js/runtime-vapor/protocol',
        replacement: path.resolve(import.meta.dirname, '../runtime-vapor/src/protocol.ts'),
      },
      {
        find: '@rue-js/runtime-vapor/reactive',
        replacement: path.resolve(import.meta.dirname, '../runtime-vapor/dist/reactive.node.js'),
      },
      {
        find: '@rue-js/runtime-vapor/vapor',
        replacement: path.resolve(import.meta.dirname, '../runtime-vapor/dist/vapor.node.js'),
      },
      {
        find: '@rue-js/runtime-vapor',
        replacement: path.resolve(import.meta.dirname, '../runtime-vapor/dist/index.node.js'),
      },
      { find: '@rue-js/rue', replacement: path.resolve(import.meta.dirname, '../rue/src') },
      { find: '@rue-js/runtime', replacement: path.resolve(import.meta.dirname, '../runtime/src') },
      {
        find: '@rue-js/server-renderer',
        replacement: path.resolve(import.meta.dirname, '../server-renderer/src'),
      },
    ],
  },
  pack: {
    alias: {
      '@rue-js/jsx-runtime': path.resolve(import.meta.dirname, 'src/shims/jsx-runtime-compat.ts'),
      '@rue-js/jsx-dev-runtime': path.resolve(
        import.meta.dirname,
        'src/shims/jsx-dev-runtime-compat.ts',
      ),
    },
    entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.d.ts'],
    clean: true,
    deps: {
      neverBundle: textRuntimeVirtualModules,
      skipNodeModulesBundle: true,
      dts: {
        neverBundle: textRuntimeVirtualModules,
      },
    },
    dts: true,
    fixedExtension: false,
    format: 'esm',
    sourcemap: true,
    unbundle: true,
  },
})
