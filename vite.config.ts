import { configDefaults, defineConfig, defineProject } from 'vitest/config'
import path from 'node:path'
import fs from 'node:fs/promises'
import tailwindcss from '@tailwindcss/vite'
import VitePluginRue from '@rue-js/vite-plugin-rue'
import { resolve } from 'node:path'
import wasm from 'vite-plugin-wasm'

const rootDir = resolve(__dirname)

const vitestProjects = [
  defineProject({
    extends: true,
    test: {
      name: 'unit',
      include: ['packages/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx,mjs,cjs}'],
      exclude: [
        ...configDefaults.exclude,
        '**/e2e/**',
        'temp/**',
        '**/{rue,rue-design,runtime,jsx-runtime}/**',
        'packages/runtime/__tests__/transition-utils.spec.ts',
      ],
    },
  }),
  defineProject({
    extends: true,
    test: {
      name: 'unit-jsdom',
      include: [
        'packages/{rue,runtime,jsx-runtime}/**/*.{test,spec}.{js,ts,jsx,tsx,mjs,cjs}',
        'packages/runtime/__tests__/transition-utils.spec.ts',
      ],
      exclude: [...configDefaults.exclude, '**/e2e/**', 'temp/**'],
      environment: 'jsdom',
    },
  }),
  defineProject({
    extends: true,
    test: {
      name: 'rue-design-jsdom',
      include: ['packages/rue-design/**/*.{test,spec}.{js,ts,jsx,tsx,mjs,cjs}'],
      exclude: [...configDefaults.exclude, '**/e2e/**', 'temp/**'],
      environment: 'jsdom',
    },
  }),
  defineProject({
    extends: true,
    test: {
      name: 'e2e',
      environment: 'jsdom',
      poolOptions: {
        threads: {
          singleThread: !!process.env.CI,
        },
      },
      exclude: [...configDefaults.exclude, 'temp/**'],
      include: ['packages/rue/__tests__/e2e/*.spec.ts'],
    },
  }),
]

export default defineConfig(({ command }) => ({
  plugins: [
    wasm(),
    tailwindcss() as any,
    VitePluginRue({
      debug: command === 'serve',
    }),
    {
      name: 'copy-docs',
      apply: 'build',
      closeBundle: async () => {
        const src = path.resolve(__dirname, 'docs')
        const dest = path.resolve(__dirname, 'dist/docs')
        const copy = async (src: string, dest: string) => {
          await fs.mkdir(dest, { recursive: true })
          const items = await fs.readdir(src, { withFileTypes: true })
          for (const it of items) {
            const sp = path.join(src, it.name)
            const dp = path.join(dest, it.name)
            if (it.isDirectory()) await copy(sp, dp)
            else await fs.copyFile(sp, dp)
          }
        }
        await copy(src, dest)
      },
    },
  ].filter(Boolean),
  css: {
    devSourcemap: true,
  },
  assetsInclude: ['**/*.md'],
  build: {
    // Keep this explicit so the build path doesn't depend on Vite's implicit
    // minifier default when toolchain internals change.
    minify: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  test: {
    globals: true,
    pool: 'threads',
    setupFiles: 'scripts/setup-vitest.ts',
    sequence: {
      hooks: 'list',
    },
    projects: vitestProjects,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**'],
      exclude: ['packages/runtime/src/components/Transition*'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 80,
        branches: 75,
      },
    },
  },
  define: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: '"test"',
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __CJS__: true,
    __SSR__: true,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_SUSPENSE__: true,
    __FEATURE_PROD_DEVTOOLS__: false,
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    __COMPAT__: true,
  },
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@rue-js/runtime-vapor/vapor': process.env.VITEST
        ? path.resolve(rootDir, 'packages/runtime-vapor/vapor.node.js')
        : path.resolve(rootDir, 'packages/runtime-vapor/vapor.js'),
      '@rue-js/runtime-vapor/reactive': process.env.VITEST
        ? path.resolve(rootDir, 'packages/runtime-vapor/reactive.node.js')
        : path.resolve(rootDir, 'packages/runtime-vapor/reactive.js'),
      '@rue-js/rue': path.resolve(rootDir, 'packages/rue/src'),
      '@rue-js/router': path.resolve(rootDir, 'packages/router/src'),
      '@rue-js/jsx-runtime': path.resolve(rootDir, 'packages/jsx-runtime/src'),
      '@rue-js/jsx-dev-runtime': path.resolve(rootDir, 'packages/jsx-dev-runtime/src'),
      '@rue-js/runtime': path.resolve(rootDir, 'packages/runtime/src'),
      '@rue-js/vite-plugin-rue': path.resolve(rootDir, 'packages/vite-plugin-rue/index.mjs'),
      '@rue-js/shared': path.resolve(rootDir, 'packages/shared/src'),
      '@rue-js/design': path.resolve(rootDir, 'packages/rue-design/src'),
      '@rue-js/runtime-vapor': process.env.VITEST
        ? path.resolve(rootDir, 'packages/runtime-vapor/pkg-node/rue_runtime_vapor.js')
        : path.resolve(rootDir, 'packages/runtime-vapor/pkg/rue_runtime_vapor.js'),
    },
  },
}))
