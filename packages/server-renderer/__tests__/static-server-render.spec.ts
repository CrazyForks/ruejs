// @vitest-environment jsdom

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { renderServerBundleRoute } from '@rue-js/server-renderer/static'

const tempDirs: string[] = []
const tempRoot = path.join(process.cwd(), 'temp')

const createTempDir = async () => {
  await mkdir(tempRoot, { recursive: true })
  const dir = await mkdtemp(path.join(tempRoot, 'rue-static-server-render-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('@rue-js/server-renderer/static server route rendering', () => {
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
})
