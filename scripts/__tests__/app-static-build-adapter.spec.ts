// @vitest-environment jsdom

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { classifyDocRoute, createDocRouteSourceMap, createRouteHtml } from '../app-static-build.mjs'
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

  it('keeps the app HTML wrapper policy for static docs and zero-JS routes', () => {
    const template = `<!doctype html>
<html lang="en">
  <head>
    <link rel="modulepreload" crossorigin href="/assets/app.js">
    <link rel="stylesheet" href="/assets/app.css">
    <script>localStorage.getItem("rue.theme")</script>
    <script type="module" crossorigin src="/assets/app.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script nomodule src="/legacy.js"></script>
  </body>
</html>`

    const staticDocHtml = createRouteHtml(
      template,
      '<main>Static markdown</main>',
      'static-doc',
      '/guide/guide/static-doc',
      new Set(),
    )
    const zeroJsSsrHtml = createRouteHtml(
      template,
      '<main>SSR without client runtime</main>',
      'ssr-prerender',
      '/guide/guide/interactive-doc?tab=pnpm',
      new Set(['/guide/guide/interactive-doc']),
    )
    const interactiveHtml = createRouteHtml(
      template,
      '<main>Interactive SSR</main>',
      'ssr-prerender',
      '/guide/guide/interactive-doc',
      new Set(),
    )

    expect(staticDocHtml).toContain('<div id="app"><main>Static markdown</main></div>')
    expect(staticDocHtml).toContain('<html lang="en" data-theme="luxury">')
    expect(staticDocHtml).toContain('<link rel="stylesheet" href="/assets/app.css">')
    expect(staticDocHtml).toContain('<script nomodule src="/legacy.js"></script>')
    expect(staticDocHtml).not.toContain('rel="modulepreload"')
    expect(staticDocHtml).not.toContain('type="module"')
    expect(staticDocHtml).not.toContain('rue.theme')

    expect(zeroJsSsrHtml).toContain('<main>SSR without client runtime</main>')
    expect(zeroJsSsrHtml).toContain('data-theme="luxury"')
    expect(zeroJsSsrHtml).not.toContain('type="module"')

    expect(interactiveHtml).toContain('<main>Interactive SSR</main>')
    expect(interactiveHtml).toContain('rel="modulepreload"')
    expect(interactiveHtml).toContain('type="module"')
    expect(interactiveHtml).toContain('rue.theme')
    expect(interactiveHtml).not.toContain('data-theme="luxury"')
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
