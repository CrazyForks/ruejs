import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildDocSearchIndex,
  findDocSources,
  toDocId,
  toDocRoute,
} from '../../../scripts/doc-source-utils.mjs'

let tempRoot: string | undefined

const createTempDocsDir = async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-doc-search-'))
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

describe('doc search index MDX sources', () => {
  it('discovers MDX docs and derives doc ids and routes', async () => {
    const docsDir = await createTempDocsDir()
    const mdxPath = await writeDoc(
      docsDir,
      'guide/quick-start.mdx',
      '# Quick Start\n\nUse Rue with your package manager.\n',
    )

    await writeDoc(docsDir, 'api/application.md', '# Application\n')

    const sources = await findDocSources(docsDir)

    expect(toDocId(docsDir, mdxPath)).toBe('guide/quick-start')
    expect(toDocRoute('guide/quick-start')).toBe('/guide/guide/quick-start')
    expect(sources.map(source => [source.docId, source.extension])).toEqual([
      ['api/application', '.md'],
      ['guide/quick-start', '.mdx'],
    ])
  })

  it('indexes heading, paragraph, and fenced code text from MDX documents', async () => {
    const docsDir = await createTempDocsDir()
    await writeDoc(
      docsDir,
      'guide/quick-start.mdx',
      `import { CodeTab, CodeTabs } from '../components/CodeTabs'

export const frontmatter = {
  label: 'Quick Start',
}

export const packageManagers = [
  'hidden-npm',
  'hidden-pnpm',
]

# Quick Start {#quick-start}

Choose a package manager, then create a Rue app.

<CodeTabs>
  <CodeTab value="pnpm">

\`\`\`sh
pnpm create rue@latest
\`\`\`

  </CodeTab>
</CodeTabs>
`,
    )

    const index = await buildDocSearchIndex(docsDir)
    const blocks = index.blocks.filter(block => block.docId === 'guide/quick-start')
    const codeBlock = blocks.find(block => block.type === 'code')

    expect(index.files).toBe(1)
    expect(blocks.map(block => block.route)).toEqual(blocks.map(() => '/guide/guide/quick-start'))
    expect(blocks).toContainEqual(
      expect.objectContaining({
        href: '/guide/guide/quick-start#quick-start',
        sectionTitle: 'Quick Start',
        text: 'Quick Start',
        title: 'Quick Start',
        type: 'heading',
      }),
    )
    expect(blocks).toContainEqual(
      expect.objectContaining({
        text: 'Choose a package manager, then create a Rue app.',
        type: 'paragraph',
      }),
    )
    expect(codeBlock).toEqual(
      expect.objectContaining({
        href: '/guide/guide/quick-start#quick-start',
        text: 'pnpm create rue@latest',
      }),
    )
    expect(blocks.map(block => block.text).join(' ')).not.toContain('CodeTabs')
    expect(blocks.map(block => block.text).join(' ')).not.toContain('frontmatter')
    expect(blocks.map(block => block.text).join(' ')).not.toContain('hidden-pnpm')
  })

  it('throws when markdown and MDX files resolve to the same doc id', async () => {
    const docsDir = await createTempDocsDir()
    await writeDoc(docsDir, 'guide/conflict.md', '# Markdown\n')
    await writeDoc(docsDir, 'guide/conflict.mdx', '# MDX\n')

    await expect(findDocSources(docsDir)).rejects.toThrow(
      /Duplicate doc source for "guide\/conflict"/,
    )
  })
})
