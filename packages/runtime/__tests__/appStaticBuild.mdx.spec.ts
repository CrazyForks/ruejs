import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { findDocSources } from '../../../scripts/doc-source-utils.mjs'
import {
  classifyDocRoute,
  createDocRouteSourceMap,
  createRouteHtml,
} from '../../../scripts/app-static-build.mjs'

let tempRoot: string | undefined

const createTempDocsDir = async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-app-static-build-'))
  return path.join(tempRoot, 'docs')
}

const writeDoc = async (docsDir: string, relativePath: string, content: string) => {
  const filePath = path.join(docsDir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content)
  return filePath
}

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  }
})

describe('app static build MDX documents', () => {
  it('classifies Markdown docs as static docs and MDX docs as SSR documents', async () => {
    const docsDir = await createTempDocsDir()
    await writeDoc(docsDir, 'guide/static-doc.md', '# Static Markdown\n')
    await writeDoc(docsDir, 'guide/interactive-doc.mdx', '# Interactive MDX\n')

    const sourceMap = createDocRouteSourceMap(await findDocSources(docsDir))

    expect(classifyDocRoute('/guide/guide/static-doc', sourceMap)).toEqual(
      expect.objectContaining({
        docId: 'guide/static-doc',
        extension: '.md',
        renderKind: 'static-doc',
      }),
    )
    expect(classifyDocRoute('/guide/guide/interactive-doc?tab=pnpm#install', sourceMap)).toEqual(
      expect.objectContaining({
        docId: 'guide/interactive-doc',
        extension: '.mdx',
        renderKind: 'ssr-prerender',
      }),
    )
    expect(classifyDocRoute('/guide/guide/missing-doc', sourceMap)).toBeNull()
  })

  it('strips client runtime only for Markdown static-doc output', () => {
    const clientRuntimeAssets = new Set(['/assets/main.js', '/assets/runtime.js'])
    const template = `<!doctype html>
<html>
  <head>
    <link rel="modulepreload" href="/assets/runtime.js">
    <link rel="modulepreload" href="/assets/user-module.js">
    <script>localStorage.getItem("rue.theme")</script>
    <script type="module" src="/assets/main.js"></script>
    <script type="module" src="/assets/user-module.js"></script>
  </head>
  <body><div id="app"></div></body>
</html>`

    const markdownHtml = createRouteHtml(
      template,
      '<main>Markdown content</main>',
      'static-doc',
      '/guide/guide/static-doc',
      new Set(),
      clientRuntimeAssets,
    )
    const mdxHtml = createRouteHtml(
      template,
      '<main>MDX content</main>',
      'ssr-prerender',
      '/guide/guide/interactive-doc',
      new Set(),
      clientRuntimeAssets,
    )

    expect(markdownHtml).toContain('<main>Markdown content</main>')
    expect(markdownHtml).toContain('rue.theme')
    expect(markdownHtml).toContain('/assets/user-module.js')
    expect(markdownHtml).not.toContain('/assets/main.js')
    expect(markdownHtml).not.toContain('/assets/runtime.js')

    expect(mdxHtml).toContain('<main>MDX content</main>')
    expect(mdxHtml).toContain('modulepreload')
    expect(mdxHtml).toContain('type="module"')
    expect(mdxHtml).toContain('rue.theme')
    expect(mdxHtml).toContain('/assets/main.js')
    expect(mdxHtml).toContain('/assets/runtime.js')
    expect(mdxHtml).toContain('/assets/user-module.js')
  })
})
