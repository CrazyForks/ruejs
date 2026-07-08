// @vitest-environment jsdom

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  createStaticRouteHtml,
  normalizeStaticRoute,
  resolveStaticPreviewFile,
  staticRouteToOutputFile,
  stripStaticClientRuntime,
} from '@rue-js/server-renderer/static'

const tempDirs: string[] = []

const createTempDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rue-static-preview-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('@rue-js/server-renderer/static', () => {
  it('normalizes static route output and strips client runtime', () => {
    const outDir = path.resolve('/tmp/rue-static-out')
    const template = `<!doctype html>
<html>
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

    const html = createStaticRouteHtml(template, '<main>Rue static</main>', {
      includeClientRuntime: false,
    })

    expect(normalizeStaticRoute('docs/guide/?q=render#intro')).toBe('/docs/guide')
    expect(normalizeStaticRoute('/')).toBe('/')
    expect(normalizeStaticRoute('   ')).toBeNull()
    expect(staticRouteToOutputFile('/docs/guide/?q=render#intro', outDir)).toBe(
      path.join(outDir, 'docs/guide/index.html'),
    )
    expect(staticRouteToOutputFile('/', outDir)).toBe(path.join(outDir, 'index.html'))
    expect(stripStaticClientRuntime(template)).not.toContain('type="module"')
    expect(html).toContain('<div id="app"><main>Rue static</main></div>')
    expect(html).toContain('<link rel="stylesheet" href="/assets/app.css">')
    expect(html).toContain('<script nomodule src="/legacy.js"></script>')
    expect(html).not.toContain('rel="modulepreload"')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('localStorage.getItem("rue.theme")')
    expect(html).not.toContain('data-theme="luxury"')
  })

  it('resolves preview files without escaping the static directory', async () => {
    const root = await createTempDir()
    const staticDir = path.join(root, 'static')
    const siblingDir = path.join(root, 'static-sibling')

    await mkdir(path.join(staticDir, 'assets'), { recursive: true })
    await mkdir(path.join(staticDir, 'docs'), { recursive: true })
    await mkdir(siblingDir, { recursive: true })
    await writeFile(path.join(staticDir, 'index.html'), '<main>home</main>')
    await writeFile(path.join(staticDir, 'docs/index.html'), '<main>docs</main>')
    await writeFile(path.join(staticDir, 'assets/app.js'), 'console.log("ok")')
    await writeFile(path.join(root, 'secret.html'), '<main>secret</main>')
    await writeFile(path.join(siblingDir, 'index.html'), '<main>sibling</main>')

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
      resolveStaticPreviewFile(staticDir, '/..%2Fstatic-sibling%2Findex.html'),
    ).resolves.toBeNull()
  })
})
