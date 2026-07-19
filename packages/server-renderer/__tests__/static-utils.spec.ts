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
    const clientRuntimeAssets = ['/assets/app.js', '/assets/runtime.js']
    const template = `<!doctype html>
<html>
  <head>
    <link rel="modulepreload" crossorigin href="/assets/runtime.js">
    <link href='/assets/user-module.js' rel='modulepreload'>
    <link rel="stylesheet" href="/assets/app.css">
    <script>localStorage.getItem("rue.theme")</script>
    <script crossorigin src="/assets/app.js" type="module"></script>
    <script src='/assets/user-module.js' type='module'></script>
  </head>
  <body>
    <div id="app"></div>
    <script nomodule src="/legacy.js"></script>
  </body>
</html>`

    const html = createStaticRouteHtml(template, '<main>Rue static</main>', {
      includeClientRuntime: false,
      clientRuntimeAssets,
    })
    const strippedTemplate = stripStaticClientRuntime(template, clientRuntimeAssets)

    expect(normalizeStaticRoute('docs/guide/?q=render#intro')).toBe('/docs/guide')
    expect(normalizeStaticRoute('/')).toBe('/')
    expect(normalizeStaticRoute('   ')).toBeNull()
    expect(staticRouteToOutputFile('/docs/guide/?q=render#intro', outDir)).toBe(
      path.join(outDir, 'docs/guide/index.html'),
    )
    expect(staticRouteToOutputFile('/', outDir)).toBe(path.join(outDir, 'index.html'))
    expect(strippedTemplate).not.toContain('/assets/app.js')
    expect(strippedTemplate).not.toContain('/assets/runtime.js')
    expect(strippedTemplate).toContain("href='/assets/user-module.js' rel='modulepreload'")
    expect(strippedTemplate).toContain("src='/assets/user-module.js' type='module'")
    expect(html).toContain('<div id="app"><main>Rue static</main></div>')
    expect(html).toContain('<link rel="stylesheet" href="/assets/app.css">')
    expect(html).toContain('<script nomodule src="/legacy.js"></script>')
    expect(html).toContain("href='/assets/user-module.js' rel='modulepreload'")
    expect(html).toContain("src='/assets/user-module.js' type='module'")
    expect(html).toContain('localStorage.getItem("rue.theme")')
    expect(html).not.toContain('/assets/app.js')
    expect(html).not.toContain('/assets/runtime.js')
    expect(html).not.toContain('data-theme="luxury"')
  })

  it('requires an explicit client runtime asset set when stripping the runtime', () => {
    // @ts-expect-error verify the runtime guard for a missing client runtime asset set
    expect(() => stripStaticClientRuntime('<script type="module" src="/app.js"></script>')).toThrow(
      /clientRuntimeAssets/,
    )
    expect(() =>
      // @ts-expect-error verify the runtime guard for an invalid zero-JS configuration
      createStaticRouteHtml('<div id="app"></div>', '<main>Rue static</main>', {
        includeClientRuntime: false,
      }),
    ).toThrow(/clientRuntimeAssets/)
  })

  it('composes named client entries without removing user-owned modules', () => {
    const template = `<!doctype html>
<html>
  <head>
    <link rel="modulepreload" crossorigin href="/assets/app-runtime.js">
    <link rel="modulepreload" crossorigin href="/assets/shared.js">
    <script type="module" crossorigin src="/assets/app.js"></script>
    <script type="module" src="/assets/user-module.js"></script>
  </head>
  <body><div id="app"></div></body>
</html>`
    const clientEntries = {
      app: {
        entry: '/assets/app.js',
        assets: new Set(['/assets/app.js', '/assets/app-runtime.js', '/assets/shared.js']),
      },
      islands: {
        entry: '/assets/islands.js',
        assets: new Set(['/assets/islands.js', '/assets/shared.js']),
      },
      docs: {
        entry: '/assets/docs.js',
        assets: new Set(['/assets/docs.js', '/assets/shared.js']),
      },
    }

    const html = createStaticRouteHtml(template, '<main>Interactive docs</main>', {
      clientModes: ['islands', 'docs'],
      clientEntries,
    })

    expect(html).toContain('<main>Interactive docs</main>')
    expect(html).toContain('src="/assets/islands.js"')
    expect(html).toContain('src="/assets/docs.js"')
    expect(html.match(/href="\/assets\/shared\.js"/g)).toHaveLength(1)
    expect(html).not.toContain('/assets/app.js')
    expect(html).not.toContain('/assets/app-runtime.js')
    expect(html).toContain('src="/assets/user-module.js"')
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
