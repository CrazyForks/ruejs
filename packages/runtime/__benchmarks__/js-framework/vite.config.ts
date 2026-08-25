import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import VitePluginRue from '@rue-js/vite-plugin-rue'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(benchmarkDir, '../../../..')
const workspaceVersion = createRequire(import.meta.url)(
  path.resolve(workspaceRoot, 'package.json'),
).version

const workspaceArtifact = (...parts: string[]) => path.resolve(workspaceRoot, ...parts)

export default defineConfig({
  root: benchmarkDir,
  base: './',
  plugins: [wasm(), VitePluginRue({ transformTimeoutMs: 60_000 })],
  resolve: {
    alias: [
      {
        find: /^@rue-js\/rue\/vapor$/,
        replacement: workspaceArtifact('packages/rue/dist/rue.vapor.esm-bundler.js'),
      },
      {
        find: /^@rue-js\/rue$/,
        replacement: workspaceArtifact('packages/rue/dist/rue.esm-bundler.js'),
      },
      {
        find: /^@rue-js\/runtime\/vapor$/,
        replacement: workspaceArtifact('packages/runtime/dist/runtime.vapor.esm-bundler.js'),
      },
      {
        find: /^@rue-js\/runtime$/,
        replacement: workspaceArtifact('packages/runtime/dist/runtime.esm-bundler.js'),
      },
      {
        find: /^@rue-js\/runtime-vapor$/,
        replacement: workspaceArtifact('packages/runtime-vapor/index.js'),
      },
      {
        find: /^@rue-js\/shared$/,
        replacement: workspaceArtifact('packages/shared/dist/shared.esm-bundler.js'),
      },
    ],
  },
  define: {
    __DEV__: false,
    __TEST__: false,
    __VERSION__: JSON.stringify(workspaceVersion),
    __BROWSER__: true,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __CJS__: false,
    __SSR__: false,
  },
  build: {
    emptyOutDir: true,
    minify: true,
    outDir: workspaceArtifact('temp/js-framework-performance/dist'),
    target: 'es2022',
    rollupOptions: {
      input: {
        rue: path.resolve(benchmarkDir, 'index.html'),
        vue: path.resolve(benchmarkDir, 'vue.html'),
      },
    },
  },
})
