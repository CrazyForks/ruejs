// @vitest-environment jsdom

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  classifyDocRoute,
  collectClientRuntimeAssets,
  createDocRouteSourceMap,
  createRouteHtml,
} from '../app-static-build.mjs'
import { findDocSources } from '../doc-source-utils.mjs'
import { resolveStaticPreviewFile } from '@rue-js/server-renderer/static'

const tempDirs: string[] = []

const createTempDir = async (prefix: string) => {
  const dir = await mkdtemp(path.join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const writeTempFile = async (root: string, relativePath: string, content: string) => {
  const file = path.join(root, relativePath)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content)
  return file
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('app static build adapter', () => {
  it('collects independent named client entry closures using the resolved base URL', () => {
    const entryFile = path.resolve('/project/app/app.tsx')
    const bundle = {
      'assets/main.js': {
        type: 'chunk',
        fileName: 'assets/main.js',
        facadeModuleId: path.resolve('/project/index.html'),
        moduleIds: [path.resolve('/project/index.html'), `${entryFile}?rue-entry`],
        imports: ['assets/runtime.js'],
        dynamicImports: ['assets/lazy.js'],
      },
      'assets/runtime.js': {
        type: 'chunk',
        fileName: 'assets/runtime.js',
        facadeModuleId: null,
        imports: ['assets/shared.js'],
        dynamicImports: [],
      },
      'assets/shared.js': {
        type: 'chunk',
        fileName: 'assets/shared.js',
        facadeModuleId: null,
        imports: [],
        dynamicImports: [],
      },
      'assets/lazy.js': {
        type: 'chunk',
        fileName: 'assets/lazy.js',
        facadeModuleId: null,
        imports: [],
        dynamicImports: [],
      },
      'assets/islands.js': {
        type: 'chunk',
        fileName: 'assets/islands.js',
        facadeModuleId: '\0virtual:rue-island-client',
        moduleIds: ['\0virtual:rue-island-client'],
        imports: ['assets/island-runtime.js', 'assets/shared.js'],
        dynamicImports: [],
      },
      'assets/island-runtime.js': {
        type: 'chunk',
        fileName: 'assets/island-runtime.js',
        facadeModuleId: null,
        imports: [],
        dynamicImports: [],
      },
      'assets/main.css': {
        type: 'asset',
        fileName: 'assets/main.css',
      },
    }

    const graphs = collectClientRuntimeAssets(
      bundle,
      { app: entryFile, islands: 'virtual:rue-island-client' },
      '/docs/',
    )

    expect(graphs.app.entry).toBe('/docs/assets/main.js')
    expect([...graphs.app.assets].sort()).toEqual([
      '/docs/assets/main.js',
      '/docs/assets/runtime.js',
      '/docs/assets/shared.js',
    ])
    expect(graphs.islands.entry).toBe('/docs/assets/islands.js')
    expect([...graphs.islands.assets].sort()).toEqual([
      '/docs/assets/island-runtime.js',
      '/docs/assets/islands.js',
      '/docs/assets/shared.js',
    ])
    expect(() => collectClientRuntimeAssets(bundle, '/project/app/missing.tsx', '/')).toThrow(
      /client entry chunk/i,
    )
  })

  it('classifies docs routes from a real docs source map', async () => {
    const docsDir = await createTempDir('rue-app-static-docs-')
    await writeTempFile(docsDir, 'guide/static-doc.md', '# Static document\n')
    await writeTempFile(docsDir, 'guide/interactive-doc.mdx', '# Interactive document\n')

    const sourceMap = createDocRouteSourceMap(await findDocSources(docsDir))

    expect(classifyDocRoute('/guide/guide/static-doc?tab=pnpm#install', sourceMap)).toEqual(
      expect.objectContaining({
        docId: 'guide/static-doc',
        extension: '.md',
        renderKind: 'static-doc',
      }),
    )
    expect(classifyDocRoute('/guide/guide/interactive-doc', sourceMap)).toEqual(
      expect.objectContaining({
        docId: 'guide/interactive-doc',
        extension: '.mdx',
        renderKind: 'ssr-prerender',
      }),
    )
    expect(classifyDocRoute('/guide/guide/missing-doc', sourceMap)).toBeNull()
    expect(classifyDocRoute('/guide/%2Fescaped', sourceMap)).toBeNull()
    expect(classifyDocRoute('/guide/bad%00doc', sourceMap)).toBeNull()
  })

  it('injects exact none/islands/app graphs while preserving user-owned head assets', () => {
    const clientEntries = {
      app: {
        entry: '/assets/app.js',
        assets: new Set(['/assets/app.js', '/assets/runtime.js', '/assets/shared.js']),
      },
      islands: {
        entry: '/assets/islands.js',
        assets: new Set(['/assets/islands.js', '/assets/island-runtime.js', '/assets/shared.js']),
      },
    }
    const template = `<!doctype html>
<html lang="en">
  <head>
    <link rel="modulepreload" crossorigin href="/assets/runtime.js">
    <link rel="modulepreload" crossorigin href="/assets/shared.js">
    <link rel="modulepreload" href="/assets/user-module.js">
    <link rel="stylesheet" href="/assets/app.css">
    <script>localStorage.getItem("rue.theme")</script>
    <script type="module" crossorigin src="/assets/app.js"></script>
    <script type="module" src="/assets/user-module.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script nomodule src="/legacy.js"></script>
  </body>
</html>`

    const noneHtml = createRouteHtml(
      template,
      '<main>Static markdown</main>',
      'static-doc',
      '/guide/guide/static-doc',
      new Set(),
      clientEntries,
    )
    const islandsHtml = createRouteHtml(
      template,
      '<main><rue-island data-rue-id="counter"></rue-island></main>',
      'ssr-prerender',
      '/guide/guide/interactive-doc?tab=pnpm',
      new Set(),
      clientEntries,
    )
    const appHtml = createRouteHtml(
      template,
      '<main>Interactive SSR</main>',
      'ssr-prerender',
      '/guide/guide/interactive-doc',
      new Set(['/guide/guide/interactive-doc']),
      clientEntries,
    )

    for (const html of [noneHtml, islandsHtml, appHtml]) {
      expect(html).toContain('<html lang="en">')
      expect(html).toContain('<link rel="stylesheet" href="/assets/app.css">')
      expect(html).toContain('<script nomodule src="/legacy.js"></script>')
      expect(html).toContain('rue.theme')
      expect(html).toContain('/assets/user-module.js')
    }

    expect(noneHtml).toContain('<div id="app"><main>Static markdown</main></div>')
    expect(noneHtml).not.toContain('/assets/app.js')
    expect(noneHtml).not.toContain('/assets/runtime.js')
    expect(noneHtml).not.toContain('/assets/islands.js')
    expect(noneHtml).not.toContain('/assets/shared.js')

    expect(islandsHtml).toContain('<rue-island data-rue-id="counter">')
    expect(islandsHtml).not.toContain('/assets/app.js')
    expect(islandsHtml).not.toContain('/assets/runtime.js')
    expect(islandsHtml).toContain('/assets/islands.js')
    expect(islandsHtml).toContain('/assets/island-runtime.js')
    expect(islandsHtml).toContain('/assets/shared.js')

    expect(appHtml).toContain('<main>Interactive SSR</main>')
    expect(appHtml).toContain('/assets/app.js')
    expect(appHtml).toContain('/assets/runtime.js')
    expect(appHtml).toContain('/assets/shared.js')
    expect(appHtml).not.toContain('/assets/islands.js')
    expect(appHtml).not.toContain('/assets/island-runtime.js')
  })

  it('resolves preview files without escaping the static output directory', async () => {
    const root = await createTempDir('rue-app-static-preview-')
    const staticDir = path.join(root, 'dist_static')
    const siblingDir = path.join(root, 'dist_static-sibling')

    await writeTempFile(staticDir, 'index.html', '<main>home</main>')
    await writeTempFile(staticDir, 'docs/index.html', '<main>docs</main>')
    await writeTempFile(staticDir, 'assets/app.js', 'console.log("ok")')
    await writeTempFile(root, 'secret.html', '<main>secret</main>')
    await writeTempFile(siblingDir, 'index.html', '<main>sibling</main>')

    await expect(resolveStaticPreviewFile(staticDir, '/docs')).resolves.toBe(
      path.join(staticDir, 'docs/index.html'),
    )
    await expect(resolveStaticPreviewFile(staticDir, '/assets/app.js')).resolves.toBe(
      path.join(staticDir, 'assets/app.js'),
    )
    await expect(resolveStaticPreviewFile(staticDir, '/missing-route')).resolves.toBe(
      path.join(staticDir, 'index.html'),
    )
    await expect(resolveStaticPreviewFile(staticDir, '/..%2Fsecret.html')).resolves.toBeNull()
    await expect(
      resolveStaticPreviewFile(staticDir, '/..%2Fdist_static-sibling%2Findex.html'),
    ).resolves.toBeNull()
  })
})
