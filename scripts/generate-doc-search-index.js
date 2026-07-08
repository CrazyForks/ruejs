// @ts-check

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildDocSearchIndex } from './doc-source-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const docsDir = path.resolve(rootDir, 'docs')
const outputFile = path.resolve(docsDir, 'search-index.json')

/**
 * @param {string} filePath
 * @param {string} content
 */
const writeIfChanged = async (filePath, content) => {
  try {
    const current = await fs.readFile(filePath, 'utf8')
    if (current === content) {
      return false
    }
  } catch {}

  await fs.writeFile(filePath, content)
  return true
}

const index = await buildDocSearchIndex(docsDir)
const content = `${JSON.stringify(index, null, 2)}\n`
const changed = await writeIfChanged(outputFile, content)

console.log(
  `[docs-search] ${changed ? 'Updated' : 'Unchanged'} docs/search-index.json (${index.files} files, ${index.blocks.length} blocks)`,
)
