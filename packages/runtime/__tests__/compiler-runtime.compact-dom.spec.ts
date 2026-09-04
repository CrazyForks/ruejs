// @vitest-environment jsdom

import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { build, type Rollup } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import {
  appendChild,
  createDocumentFragment,
  createElement,
  insertBefore,
  template,
  withDOMHostOperations,
} from '../src/compiler-runtime/dom.browser'

const projectRoot = process.cwd()
const fixtureDir = path.resolve(projectRoot, 'temp/compiler-runtime-compact-dom')

const getEntryChunk = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) => {
  const outputs = Array.isArray(result) ? result : [result]
  const chunk = outputs
    .flatMap(output => output.output)
    .find(output => output.type === 'chunk' && output.isEntry)
  if (!chunk || chunk.type !== 'chunk') throw new Error('failed to build compact DOM fixture')
  return chunk
}

afterAll(() => rm(fixtureDir, { recursive: true, force: true }))

describe('compact compiler DOM runtime', () => {
  it('preserves HTML, SVG, fragment, insertion, and host context behavior', () => {
    const host = document.createElement('main')
    const first = document.createTextNode('first')
    appendChild(host, first)

    withDOMHostOperations(host, () => {
      const html = createElement('section')
      const fragment = createDocumentFragment()
      const svg = createElement('svg')
      const circle = createElement('circle', svg)
      appendChild(svg, circle)
      appendChild(fragment, html)
      appendChild(fragment, svg)
      insertBefore(host, fragment, first)

      const htmlTemplate = template('<strong>html</strong>')()
      expect(htmlTemplate.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/1999/xhtml',
      )

      withDOMHostOperations(svg, () => {
        const svgTemplate = template('<path />')()
        expect(svgTemplate.content.firstElementChild?.namespaceURI).toBe(
          'http://www.w3.org/2000/svg',
        )
      })
    })

    expect(host.childNodes).toHaveLength(3)
    expect(host.firstElementChild?.localName).toBe('section')
    expect(host.children[1]?.localName).toBe('svg')
    expect(host.children[1]?.firstElementChild?.localName).toBe('circle')
    expect(host.lastChild).toBe(first)
  })

  it('does not include the full DOM adapter in the compiler DOM build graph', async () => {
    await mkdir(fixtureDir, { recursive: true })
    const entry = path.resolve(fixtureDir, 'entry.mjs')
    await writeFile(
      entry,
      `export { createElement, createDocumentFragment, appendChild, insertBefore, template, withDOMHostOperations } from '../../packages/runtime/src/compiler-runtime/dom.browser.ts'`,
      'utf8',
    )

    const result = await build({
      root: projectRoot,
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      build: {
        target: 'es2020',
        minify: false,
        write: false,
        lib: { entry, formats: ['es'], fileName: 'compiler-runtime-compact-dom' },
      },
    })
    const chunk = getEntryChunk(result as Rollup.RollupOutput | Rollup.RollupOutput[])

    expect(chunk.moduleIds).toContain(
      path.resolve(projectRoot, 'packages/runtime/src/compiler-runtime/dom.browser.ts'),
    )
    expect(chunk.moduleIds).not.toContain(path.resolve(projectRoot, 'packages/runtime/src/dom.ts'))
  })
})
