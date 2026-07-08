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
    const template = `<!doctype html>
<html>
  <head>
    <link rel="modulepreload" href="/assets/main.js">
    <script>localStorage.getItem("rue.theme")</script>
    <script type="module" src="/assets/main.js"></script>
  </head>
  <body><div id="app"></div></body>
</html>`

    const markdownHtml = createRouteHtml(
      template,
      '<main>Markdown content</main>',
      'static-doc',
      '/guide/guide/static-doc',
      new Set(),
    )
    const mdxHtml = createRouteHtml(
      template,
      '<main>MDX content</main>',
      'ssr-prerender',
      '/guide/guide/interactive-doc',
      new Set(),
    )

    expect(markdownHtml).toContain('<main>Markdown content</main>')
    expect(markdownHtml).toContain('data-theme="luxury"')
    expect(markdownHtml).not.toContain('modulepreload')
    expect(markdownHtml).not.toContain('type="module"')
    expect(markdownHtml).not.toContain('rue.theme')

    expect(mdxHtml).toContain('<main>MDX content</main>')
    expect(mdxHtml).toContain('modulepreload')
    expect(mdxHtml).toContain('type="module"')
    expect(mdxHtml).toContain('rue.theme')
  })
})
