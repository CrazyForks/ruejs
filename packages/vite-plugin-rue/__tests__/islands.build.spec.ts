// @vitest-environment jsdom

import fs from 'node:fs/promises'
import { execFile as execFileCallback } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import wasm from 'vite-plugin-wasm'

import { createStaticRouteHtml } from '@rue-js/server-renderer/static'
import { startRueIslandLoader, type RueIslandClientModule } from '@rue-js/runtime/island'
import VitePluginRue from '../index.mjs'

const fixtureRoot = path.resolve('packages/vite-plugin-rue/__tests__/fixtures/islands')
const repoRoot = path.resolve('.')
const temporaryRoots: string[] = []
const execFile = promisify(execFileCallback)

afterEach(async () => {
  delete globalThis.__rueIslandFixtureHydrationOrder
  await Promise.all(
    temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })),
  )
  document.body.innerHTML = ''
})

const buildFixture = async (outDir: string, input: string, ssr = false) => {
  const result = await build({
    configFile: false,
    root: fixtureRoot,
    logLevel: 'silent',
    plugins: [
      wasm(),
      VitePluginRue({
        include: [fixtureRoot],
        transformTimeoutMs: 60_000,
      }),
    ],
    resolve: {
      conditions: ['development', 'browser'],
      alias: {
        '@rue-js/runtime-vapor/vapor': path.join(
          repoRoot,
          `packages/runtime-vapor/vapor${ssr ? '.node' : ''}.js`,
        ),
        '@rue-js/runtime-vapor/reactive': path.join(
          repoRoot,
          `packages/runtime-vapor/reactive${ssr ? '.node' : ''}.js`,
        ),
        '@rue-js/rue': path.join(repoRoot, 'packages/rue/src'),
        '@rue-js/runtime': path.join(repoRoot, 'packages/runtime/src'),
        '@rue-js/server-renderer': path.join(repoRoot, 'packages/server-renderer/src'),
        '@rue-js/runtime-vapor': path.join(
          repoRoot,
          `packages/runtime-vapor/index${ssr ? '.node' : ''}.js`,
        ),
      },
    },
    build: {
      emptyOutDir: true,
      manifest: !ssr,
      minify: false,
      outDir,
      ssr: ssr ? input : false,
      target: 'es2022',
      write: true,
      rolldownOptions: {
        input,
        output: ssr
          ? { entryFileNames: 'entry-server.mjs', format: 'es' }
          : { entryFileNames: 'assets/[name]-[hash].js', format: 'es' },
      },
    },
    ssr: { noExternal: true },
  })
  return (Array.isArray(result) ? result[0] : result) as Rollup.RollupOutput
}

const collectStaticClosure = (bundle: Rollup.OutputBundle, entry: Rollup.OutputChunk) => {
  const assets = new Set<string>()
  const visit = (fileName: string) => {
    if (assets.has(`/${fileName}`)) return
    const chunk = bundle[fileName]
    if (!chunk || chunk.type !== 'chunk') return
    assets.add(`/${chunk.fileName}`)
    chunk.imports.forEach(visit)
  }
  visit(entry.fileName)
  return { entry: `/${entry.fileName}`, assets }
}

const template = `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/fixture.css">
    <link rel="modulepreload" href="/user-module.js">
    <script>document.documentElement.dataset.theme = 'fixture'</script>
    <script type="module" src="/user-module.js"></script>
  </head>
  <body><div id="app"></div><script nomodule src="/legacy.js"></script></body>
</html>`

const renderBuiltServerPages = async (serverEntryFile: string) => {
  const script = `
    const server = await import(${JSON.stringify(pathToFileURL(serverEntryFile).href)});
    const routes = ['static', 'load', 'only', 'nested'];
    const pages = Object.fromEntries(await Promise.all(
      routes.map(async route => [route, await server.renderFixturePage(route)]),
    ));
    process.stdout.write(JSON.stringify(pages));
  `
  const { stdout } = await execFile(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  })
  return JSON.parse(stdout) as Record<'static' | 'load' | 'only' | 'nested', string>
}

describe('Rue island real build contract', () => {
  it('keeps static pages zero-JS and hydrates real lazy island chunks in parent-first order', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-islands-build-'))
    temporaryRoots.push(tempRoot)
    const clientOutDir = path.join(tempRoot, 'client')
    const serverOutDir = path.join(tempRoot, 'server')
    const clientEntry = path.join(fixtureRoot, 'entry-client.ts')
    const serverEntry = path.join(fixtureRoot, 'entry-server.tsx')

    const clientBuild = await buildFixture(clientOutDir, clientEntry)
    const serverBuild = await buildFixture(serverOutDir, serverEntry, true)
    await fs.cp(
      path.resolve('packages/runtime-vapor/pkg-node'),
      path.join(serverOutDir, 'pkg-node'),
      {
        recursive: true,
      },
    )

    const bundle = Object.fromEntries(clientBuild.output.map(output => [output.fileName, output]))
    const entryChunk = clientBuild.output.find(
      (output): output is Rollup.OutputChunk =>
        output.type === 'chunk' && output.isEntry && output.facadeModuleId === clientEntry,
    )
    expect(entryChunk).toBeTruthy()
    const clientGraph = collectStaticClosure(bundle, entryChunk!)
    const counterChunk = clientBuild.output.find(
      (output): output is Rollup.OutputChunk =>
        output.type === 'chunk' && output.moduleIds.some(id => id.includes('/components/Counter')),
    )
    const onlyChunk = clientBuild.output.find(
      (output): output is Rollup.OutputChunk =>
        output.type === 'chunk' &&
        output.moduleIds.some(id => id.includes('/components/OnlyPanel')),
    )
    const builtModuleIds = clientBuild.output.flatMap(output =>
      output.type === 'chunk' ? output.moduleIds : [],
    )
    expect(counterChunk, `client modules: ${builtModuleIds.join(', ')}`).toBeTruthy()
    expect(onlyChunk, `client modules: ${builtModuleIds.join(', ')}`).toBeTruthy()
    expect(clientGraph.assets).not.toContain(`/${counterChunk!.fileName}`)
    expect(clientGraph.assets).not.toContain(`/${onlyChunk!.fileName}`)
    expect(entryChunk!.dynamicImports).toEqual(
      expect.arrayContaining([counterChunk!.fileName, onlyChunk!.fileName]),
    )

    const serverEntryChunk = serverBuild.output.find(
      (output): output is Rollup.OutputChunk => output.type === 'chunk' && output.isEntry,
    )
    expect(serverEntryChunk).toBeTruthy()
    const serverFiles = await fs.readdir(serverOutDir, { recursive: true })
    expect(serverFiles, `server output: ${serverFiles.join(', ')}`).toContain(
      serverEntryChunk!.fileName,
    )
    const pages = await renderBuiltServerPages(path.join(serverOutDir, serverEntryChunk!.fileName))
    const clientEntries = {
      app: { entry: '/unused-app.js', assets: new Set(['/unused-app.js']) },
      islands: clientGraph,
    }
    const html = {
      static: createStaticRouteHtml(template, pages.static, {
        clientMode: 'none',
        clientEntries,
      }),
      load: createStaticRouteHtml(template, pages.load, {
        clientMode: 'islands',
        clientEntries,
      }),
      only: createStaticRouteHtml(template, pages.only, {
        clientMode: 'islands',
        clientEntries,
      }),
      nested: createStaticRouteHtml(template, pages.nested, {
        clientMode: 'islands',
        clientEntries,
      }),
    }

    for (const output of Object.values(html)) {
      expect(output).toContain('/fixture.css')
      expect(output).toContain('/user-module.js')
      expect(output).toContain("dataset.theme = 'fixture'")
      expect(output).toContain('/legacy.js')
    }
    expect(html.static).not.toContain(clientGraph.entry)
    expect(html.static).not.toMatch(/<rue-island(?:\s|>)/)
    expect(html.load).toContain(clientGraph.entry)
    expect(html.load).toContain('<rue-island')
    expect(html.only).toContain('data-only-fallback')
    expect(html.only).toContain('only fallback')
    expect(html.only).not.toContain('data-only-client')
    expect(html.nested.match(/<rue-island/g)).toHaveLength(2)

    document.body.innerHTML = html.nested
    const nestedIds = [...document.querySelectorAll('rue-island')].map(island =>
      island.getAttribute('data-rue-id'),
    ) as string[]
    const originalRequestIdleCallback = globalThis.requestIdleCallback
    globalThis.requestIdleCallback = callback => {
      queueMicrotask(() => callback({ didTimeout: false, timeRemaining: () => 50 }))
      return 1
    }
    const stopFixtureIslands = startRueIslandLoader({
      root: document,
      resolveModule: () =>
        import('./fixtures/islands/components/Counter') as Promise<RueIslandClientModule>,
    })
    await expect.poll(() => globalThis.__rueIslandFixtureHydrationOrder ?? []).toEqual(nestedIds)
    expect(
      [...document.querySelectorAll('rue-island')].map(island =>
        island.getAttribute('data-rue-status'),
      ),
    ).toEqual(['hydrated', 'hydrated'])

    stopFixtureIslands?.()
    globalThis.requestIdleCallback = originalRequestIdleCallback
  }, 120_000)
})
