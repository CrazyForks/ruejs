import { defineConfig } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { minify as minifySwc } from '@swc/core'
import VitePluginRue from '@rue-js/vite-plugin-rue'

const demoDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(demoDir, '../..')

function swcMinifyBundle() {
  return {
    name: 'rue-ssr-binary-demo-swc-minify',
    apply: 'build',
    async generateBundle(outputOptions, bundle) {
      await Promise.all(
        Object.values(bundle).map(async chunk => {
          if (chunk.type !== 'chunk') {
            return
          }

          const { code } = await minifySwc(chunk.code, {
            module: outputOptions.format === 'es',
            compress: {
              ecma: 2022,
              pure_getters: true,
              passes: 2,
            },
            format: {
              comments: false,
            },
            mangle: true,
          })

          chunk.code = code
          chunk.map = null
        }),
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const isClient = mode === 'client'
  const entryName = isClient ? 'client.js' : 'ssr-entry.js'
  const gzipBuiltEntry = () => ({
    name: 'rue-ssr-binary-demo-gzip',
    apply: 'build',
    closeBundle: async () => {
      const file = path.resolve(demoDir, 'dist', entryName)
      const code = await fs.readFile(file)
      await fs.writeFile(`${file}.gz`, gzipSync(code, { level: 9 }))
    },
  })

  return {
    plugins: [
      VitePluginRue({
        transformTimeoutMs: 60000,
      }),
      swcMinifyBundle(),
      gzipBuiltEntry(),
    ],
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: '@rue-js',
    },
    define: {
      __BROWSER__: JSON.stringify(isClient),
      __COMPAT__: 'true',
      __DEV__: 'false',
      __ESM_BROWSER__: JSON.stringify(isClient),
      __ESM_BUNDLER__: 'true',
      __FEATURE_OPTIONS_API__: 'true',
      __FEATURE_PROD_DEVTOOLS__: 'false',
      __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      __FEATURE_SUSPENSE__: 'true',
      __GLOBAL__: 'false',
      __SSR__: JSON.stringify(!isClient),
      __TEST__: 'false',
      __VERSION__: '"0.0.0-demo"',
    },
    resolve: {
      conditions: ['development', 'browser'],
      alias: {
        '@rue-js/jsx-runtime': path.resolve(repoRoot, 'packages/jsx-runtime/src'),
        '@rue-js/runtime-vapor/protocol': path.resolve(
          repoRoot,
          'packages/runtime-vapor/src/protocol.ts',
        ),
        '@rue-js/runtime-vapor/vapor': path.resolve(
          repoRoot,
          'packages/runtime-vapor/dist/vapor.js',
        ),
        '@rue-js/runtime-vapor/reactive': path.resolve(
          repoRoot,
          'packages/runtime-vapor/dist/reactive.js',
        ),
        '@rue-js/runtime-vapor': path.resolve(repoRoot, 'packages/runtime-vapor/dist/index.js'),
        '@rue-js/runtime/server': path.resolve(repoRoot, 'packages/runtime/src/server.ts'),
        '@rue-js/runtime': path.resolve(repoRoot, 'packages/runtime/src'),
        '@rue-js/rue': path.resolve(repoRoot, 'packages/rue/src'),
        '@rue-js/server-renderer': path.resolve(repoRoot, 'packages/server-renderer/src'),
        '@rue-js/shared': path.resolve(repoRoot, 'packages/shared/src'),
      },
    },
    build: {
      emptyOutDir: !isClient,
      lib: {
        entry: path.resolve(demoDir, isClient ? 'src/client.tsx' : 'src/app.tsx'),
        fileName: () => entryName,
        formats: ['es'],
      },
      minify: false,
      rollupOptions: {
        external: [],
        output: {
          entryFileNames: entryName,
        },
      },
      ssr: true,
      target: 'es2022',
    },
  }
})
