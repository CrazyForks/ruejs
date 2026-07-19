// @vitest-environment jsdom

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderServerBundleRoute, renderServerEntryRoute } from '@rue-js/server-renderer/static'

const tempDirs: string[] = []
const tempRoot = path.join(process.cwd(), 'temp')

const createTempDir = async () => {
  await mkdir(tempRoot, { recursive: true })
  const dir = await mkdtemp(path.join(tempRoot, 'rue-static-server-render-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('@rue-js/server-renderer/static server route rendering', () => {
  it('renders multiple routes from one preloaded server entry without leaking globals', async () => {
    const root = await createTempDir()
    const bundleFile = path.join(root, 'server-entry.mjs')
    const evaluationFile = path.join(root, 'evaluations.log')
    const firstOutputFile = path.join(root, 'dist/first/index.html')
    const secondOutputFile = path.join(root, 'dist/second/index.html')

    await writeFile(
      bundleFile,
      `
import { appendFileSync } from 'node:fs'

appendFileSync(${JSON.stringify(evaluationFile)}, 'loaded\\n')

export const render = async route =>
  '<main>' + route + ':' + (globalThis.__RUE_STATIC_TEST_VALUE__ ?? 'none') + '</main>'
`,
    )

    const serverEntry = await import(pathToFileURL(bundleFile).href)

    await renderServerEntryRoute({
      render: serverEntry.render,
      route: '/first',
      outputFile: firstOutputFile,
      extraGlobals: { __RUE_STATIC_TEST_VALUE__: 'first-only' },
    })
    await renderServerEntryRoute({
      render: serverEntry.render,
      route: '/second',
      outputFile: secondOutputFile,
    })

    await expect(readFile(evaluationFile, 'utf-8')).resolves.toBe('loaded\n')
    await expect(readFile(firstOutputFile, 'utf-8')).resolves.toBe('<main>/first:first-only</main>')
    await expect(readFile(secondOutputFile, 'utf-8')).resolves.toBe('<main>/second:none</main>')
    expect(globalThis).not.toHaveProperty('__RUE_STATIC_TEST_VALUE__')
  })

  it('renders a server bundle route inside static DOM', async () => {
    const root = await createTempDir()
    const bundleFile = path.join(root, 'server-entry.mjs')
    const outputFile = path.join(root, 'dist/docs/guide/index.html')

    await mkdir(path.dirname(bundleFile), { recursive: true })
    await writeFile(
      bundleFile,
      `
export const render = async route => {
  const root = document.querySelector('#app')
  const canvasWidth = document.createElement('canvas').getContext('2d').measureText(route).width

  root.innerHTML = [
    '<main data-route="' + route + '">',
    '<span>' + location.pathname + '</span>',
    '<span>' + matchMedia('(min-width: 1px)').matches + '</span>',
    '<span>' + (new ResizeObserver(() => {})).constructor.name + '</span>',
    '<span>' + canvasWidth + '</span>',
    '<span>' + globalThis.__RUE_STATIC_TEST_VALUE__ + '</span>',
    '</main>',
  ].join('')

  return '<!doctype html>' + document.documentElement.outerHTML
}
`,
    )

    await expect(
      renderServerBundleRoute({
        serverBundleFile: bundleFile,
        route: '/docs/guide?tab=api#render',
        outputFile,
        extraGlobals: {
          __RUE_STATIC_TEST_VALUE__: 'from-extra-global',
        },
      }),
    ).resolves.toMatchObject({
      route: '/docs/guide',
      outputFile,
    })

    await expect(readFile(outputFile, 'utf-8')).resolves.toContain(
      '<main data-route="/docs/guide">',
    )
    await expect(readFile(outputFile, 'utf-8')).resolves.toContain('<span>from-extra-global</span>')
    expect(globalThis).not.toHaveProperty('__RUE_STATIC_TEST_VALUE__')
  })

  it('rejects server bundles without render exports', async () => {
    const root = await createTempDir()
    const bundleFile = path.join(root, 'missing-render.mjs')
    const outputFile = path.join(root, 'dist/index.html')

    await writeFile(bundleFile, 'export const notRender = () => "<main>nope</main>"')

    await expect(
      renderServerBundleRoute({
        serverBundleFile: bundleFile,
        route: '/',
        outputFile,
      }),
    ).rejects.toThrow('SSR bundle does not export render(route).')
    expect(globalThis).not.toHaveProperty('notRender')
  })

  it('provides no-op scrolling methods without JSDOM not-implemented errors', async () => {
    const root = await createTempDir()
    const bundleFile = path.join(root, 'server-entry.mjs')
    const outputFile = path.join(root, 'dist/index.html')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await writeFile(
      bundleFile,
      `
export const render = async () => {
  window.scroll(0, 10)
  window.scrollBy(0, 10)
  window.scrollTo(0, 0)
  return '<main>scrolled</main>'
}
`,
    )

    await expect(
      renderServerBundleRoute({ serverBundleFile: bundleFile, route: '/', outputFile }),
    ).resolves.toMatchObject({ outputFile })
    expect(consoleError).not.toHaveBeenCalled()
  })
})
