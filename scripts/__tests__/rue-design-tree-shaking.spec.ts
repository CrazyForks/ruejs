// @vitest-environment jsdom

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { build, type Rollup } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const fixtureDir = path.resolve(projectRoot, 'temp/rue-design-tree-shaking')
const siteOutDir = path.resolve(fixtureDir, 'site-dist')

const componentSignatures = {
  Button: 'data-rue-button-group',
  Calendar: 'data-rue-calendar-action',
  Table: 'data-rue-table-root',
  Tree: 'data-rue-tree-node',
} as const

const asOutputs = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) =>
  Array.isArray(result) ? result : [result]

const getChunks = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) =>
  asOutputs(result)
    .flatMap(output => output.output)
    .filter(output => output.type === 'chunk')

const getEntryChunk = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) => {
  const chunk = getChunks(result).find(output => output.isEntry)
  if (!chunk) {
    throw new Error('failed to generate Rue Design tree-shaking fixture')
  }
  return chunk
}

const buildPublishedConsumer = async (fixtureName: string, entry: string) => {
  await mkdir(fixtureDir, { recursive: true })
  const entryFile = path.resolve(fixtureDir, `${fixtureName}.mjs`)
  await writeFile(entryFile, entry, 'utf8')

  const result = await build({
    root: projectRoot,
    configFile: false,
    publicDir: false,
    appType: 'custom',
    logLevel: 'silent',
    mode: 'production',
    resolve: {
      conditions: ['module', 'browser', 'production'],
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    build: {
      target: 'es2020',
      minify: false,
      write: false,
      lib: {
        entry: entryFile,
        formats: ['es'],
        fileName: fixtureName,
      },
      rollupOptions: {
        external: id => /^@rue-js\/(?:router|rue|shared)(?:\/|$)/.test(id) || id === 'csstype',
      },
    },
  })

  return getEntryChunk(result)
}

const implementationHits = (code: string) =>
  Object.fromEntries(
    Object.entries(componentSignatures).filter(([, signature]) => code.includes(signature)),
  )

const chunkContaining = (chunks: Rollup.OutputChunk[], moduleIdSuffix: string) =>
  chunks.find(chunk =>
    Object.keys(chunk.modules).some(id => id.replaceAll('\\', '/').endsWith(moduleIdSuffix)),
  )

const collectStaticImports = (entry: Rollup.OutputChunk, chunks: Rollup.OutputChunk[]) => {
  const chunksByFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  const visited = new Set<string>()
  const pending = [...entry.imports]

  while (pending.length > 0) {
    const fileName = pending.pop()!
    if (visited.has(fileName)) continue
    visited.add(fileName)
    pending.push(...(chunksByFileName.get(fileName)?.imports ?? []))
  }

  return visited
}

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true })
})

describe('Rue Design consumer tree-shaking', () => {
  it('keeps only Button when consuming its published component subpath', async () => {
    const chunk = await buildPublishedConsumer(
      'button-subpath',
      `export { default as Button } from '@rue-js/design/button'`,
    )
    const normalizedModuleIds = chunk.moduleIds.map(id => id.replaceAll('\\', '/'))

    expect(normalizedModuleIds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/packages\/rue-design\/dist\/components\/esm\/button\.js$/),
        expect.stringMatching(/packages\/rue-design\/dist\/components\/esm\/_chunks\/.+\.js$/),
      ]),
    )
    expect(
      normalizedModuleIds.filter(id =>
        /packages\/rue-design\/dist\/components\/esm\/(?:calendar|table|tree)\.js$/.test(id),
      ),
    ).toEqual([])
    expect(implementationHits(chunk.code)).toEqual({
      Button: componentSignatures.Button,
    })
  })

  it('tree-shakes unrelated implementations from a named root import', async () => {
    const chunk = await buildPublishedConsumer(
      'button-root',
      `export { Button } from '@rue-js/design'`,
    )

    expect(chunk.moduleIds.map(id => id.replaceAll('\\', '/'))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/packages\/rue-design\/dist\/rue-design\.esm-bundler\.js$/),
      ]),
    )
    expect(implementationHits(chunk.code)).toEqual({
      Button: componentSignatures.Button,
    })
  })

  it('keeps design pages lazy without a forced all-components site chunk', async () => {
    await mkdir(fixtureDir, { recursive: true })
    const result = await build({
      root: projectRoot,
      configFile: path.resolve(projectRoot, 'vite.config.ts'),
      mode: 'production',
      logLevel: 'silent',
      build: {
        outDir: siteOutDir,
        emptyOutDir: true,
      },
    })
    const chunks = getChunks(result)
    const entry = chunks.find(chunk => chunk.isEntry)
    if (!entry) throw new Error('failed to generate the Rue site entry chunk')

    const designPageChunks = ['Button', 'Calendar', 'Table', 'Tree'].map(page => {
      const chunk = chunkContaining(chunks, `/app/pages/design/${page}.tsx`)
      if (!chunk) throw new Error(`missing dynamic design page chunk for ${page}`)
      return chunk
    })
    const staticImports = collectStaticImports(entry, chunks)

    expect(designPageChunks.every(chunk => chunk.isDynamicEntry)).toBe(true)
    expect(designPageChunks.filter(chunk => staticImports.has(chunk.fileName))).toEqual([])
    expect(chunks.some(chunk => chunk.name === 'rue-runtime')).toBe(true)
    expect(chunks.some(chunk => chunk.name === 'rue-router')).toBe(true)

    const forcedDesignChunks = chunks
      .filter(
        chunk =>
          chunk.name === 'rue-design' || /(?:^|\/)rue-design-[^/]+\.js$/.test(chunk.fileName),
      )
      .map(chunk => ({
        fileName: chunk.fileName,
        moduleCount: chunk.moduleIds.length,
        size: Buffer.byteLength(chunk.code),
      }))
    expect(forcedDesignChunks).toEqual([])

    const html = await readFile(path.resolve(siteOutDir, 'index.html'), 'utf8')
    expect(html).not.toMatch(/<link[^>]+rel="modulepreload"[^>]+rue-design-[^"']+\.js/)
  }, 120_000)
})
