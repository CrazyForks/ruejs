import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import VitePluginRue from '@rue-js/vite-plugin-rue'
import { build, type Rollup } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import { BENCHMARK_GZIP_LIMIT } from '../js-framework-benchmark-size.js'

const projectRoot = process.cwd()
const benchmarkSourceDir = path.resolve(
  projectRoot,
  'scripts/__tests__/fixtures/benchmark-compiler-entry',
)
const fixtureDir = path.resolve(projectRoot, 'temp/benchmark-compiler-entry')
const fixtureSourceDir = path.resolve(fixtureDir, 'src')

const getEntryChunk = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) => {
  const outputs = Array.isArray(result) ? result : [result]
  const chunk = outputs
    .flatMap(output => output.output)
    .find(output => output.type === 'chunk' && output.isEntry)
  if (!chunk || chunk.type !== 'chunk') throw new Error('failed to build rue-signal fixture')
  return chunk
}

afterAll(() => rm(fixtureDir, { recursive: true, force: true }))

describe('rue-signal benchmark compiler entry', () => {
  it('uses only the compact compiler runtime and stays within the gzip budget', async () => {
    await mkdir(fixtureSourceDir, { recursive: true })
    await Promise.all([
      cp(path.resolve(benchmarkSourceDir, 'main.tsx'), path.resolve(fixtureSourceDir, 'main.tsx')),
      cp(path.resolve(benchmarkSourceDir, 'data.ts'), path.resolve(fixtureSourceDir, 'data.ts')),
    ])
    const fixtureEntry = path.resolve(fixtureSourceDir, 'main.tsx')
    const publicSignalSource = (await readFile(fixtureEntry, 'utf8')).replace(
      "from '@rue-js/rue/internal/compiler'",
      "from '@rue-js/rue'",
    )
    await writeFile(fixtureEntry, publicSignalSource)

    const result = await build({
      root: fixtureDir,
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      mode: 'production',
      plugins: [VitePluginRue({ include: ['/src/'] })],
      resolve: {
        alias: [
          {
            find: /^@rue-js\/rue\/internal\/compiler$/,
            replacement: path.resolve(
              projectRoot,
              'packages/rue/dist/rue.internal-compiler.esm-bundler.js',
            ),
          },
          {
            find: /^@rue-js\/rue\/internal$/,
            replacement: path.resolve(projectRoot, 'packages/rue/dist/rue.internal.esm-bundler.js'),
          },
        ],
      },
      define: {
        __DEV__: false,
        __TEST__: false,
        __VERSION__: JSON.stringify('test'),
        __BROWSER__: true,
        __GLOBAL__: false,
        __ESM_BUNDLER__: true,
        __ESM_BROWSER__: false,
        __SSR__: false,
      },
      build: {
        target: 'es2022',
        minify: true,
        write: false,
        lib: {
          entry: path.resolve(fixtureSourceDir, 'main.tsx'),
          formats: ['es'],
          fileName: 'main',
        },
        rollupOptions: { treeshake: { moduleSideEffects: false } },
      },
    })
    const chunk = getEntryChunk(result as Rollup.RollupOutput | Rollup.RollupOutput[])
    const normalizedModuleIds = chunk.moduleIds.map(id => id.replaceAll('\\', '/'))

    expect(
      normalizedModuleIds.some(id => id.endsWith('/compiler-runtime/compact-root.js')),
      normalizedModuleIds.join('\n'),
    ).toBe(true)
    expect(normalizedModuleIds.some(id => id.endsWith('/runtime.internal.esm-bundler.js'))).toBe(
      false,
    )
    expect(gzipSync(chunk.code).byteLength).toBeLessThanOrEqual(BENCHMARK_GZIP_LIMIT)
  })
})
