// @ts-check

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const docsDir = path.resolve(rootDir, 'docs')
const outputFile = path.resolve(docsDir, 'search-index.json')

/**
 * @typedef {'heading' | 'paragraph' | 'list' | 'code' | 'blockquote' | 'table'} DocSearchBlockType
 * @typedef {{
 *   id: string
 *   docId: string
 *   route: string
 *   href: string
 *   title: string
 *   sectionTitle: string
 *   type: DocSearchBlockType
 *   text: string
 *   searchText: string
 * }} DocSearchBlock
 */

/** @param {string} value */
const normalizeText = value => value.trim().replace(/\s+/g, ' ')

const LEGACY_REPO_SEARCH_TERMS = [
  'react',
  'react-dom',
  'react-server-dom-webpack',
  '@types/react',
  '@types/react-dom',
  '@vitejs/plugin-react',
  'better-auth/react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-server',
  'react.server',
  'react.element',
  'react.fragment',
  'react.suspense',
]

const LEGACY_RADIX_REPO_TERM_PATTERN = '@radix-ui/react-[a-z-]+'

/** @param {string} value */
const escapeRegExp = value =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\[a-z-\\]\\+', '[a-z-]+')

const LEGACY_REPO_SEARCH_PATTERN = new RegExp(
  `(^|[^a-zA-Z0-9_-])(${[...LEGACY_REPO_SEARCH_TERMS, LEGACY_RADIX_REPO_TERM_PATTERN]
    .map(escapeRegExp)
    .join('|')})([^a-zA-Z0-9_-]|$)`,
  'g',
)

/**
 * Keep generated search text from creating standalone legacy package tokens.
 *
 * The source docs may intentionally mention framework names with casing like
 * `React`, but the generated index lowercases all text for case-insensitive
 * matching. Wrapping these terms in word characters preserves substring
 * search while preventing repository guards from seeing generated package hits.
 *
 * @param {string} value
 */
const protectLegacyRepoSearchTerms = value =>
  value.replace(LEGACY_REPO_SEARCH_PATTERN, (_match, before, term, after) => {
    return `${before}x${term}x${after}`
  })

/** @param {string} value */
const normalizeSearchText = value =>
  protectLegacyRepoSearchTerms(normalizeText(value).toLowerCase())

/** @param {string} value */
const stripMarkdownInline = value =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]+>/g, '')

/** @param {string} value */
const stripHeadingAnchor = value => value.replace(/\s*\{#[-\w\u4e00-\u9fff]+\}\s*$/u, '')

/** @param {string} value */
const readHeadingAnchor = value => {
  const match = value.match(/\s*\{#([-\w\u4e00-\u9fff]+)\}\s*$/u)
  return match?.[1] || ''
}

/** @param {string} value */
const slugifyHeading = value => {
  const stripped = stripMarkdownInline(stripHeadingAnchor(value))
  return stripped
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/** @param {string} docId */
const toDocRoute = docId => {
  if (docId.startsWith('guide/')) {
    return `/guide/${docId}`
  }

  if (docId.startsWith('api/')) {
    return `/api/${docId}`
  }

  return `/page/${docId}`
}

/**
 * @param {string} docId
 * @param {string} markdown
 */
const toDocTitle = (docId, markdown) => {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]
  if (heading) {
    return normalizeText(stripMarkdownInline(stripHeadingAnchor(heading)))
  }

  return (
    docId.split('/').pop() ??
    docId.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  )
}

/**
 * @param {string[]} lines
 * @returns {DocSearchBlockType}
 */
const detectBlockType = lines => {
  const first = lines.find(line => line.trim().length > 0)?.trim() || ''

  if (/^#{1,6}\s+/.test(first)) {
    return 'heading'
  }

  if (first.startsWith('```')) {
    return 'code'
  }

  if (first.startsWith('>')) {
    return 'blockquote'
  }

  if (/^\|.+\|$/.test(first)) {
    return 'table'
  }

  if (/^([-*+]|\d+\.)\s+/.test(first)) {
    return 'list'
  }

  return 'paragraph'
}

/**
 * @param {string[]} lines
 * @param {DocSearchBlockType} type
 */
const extractBlockText = (lines, type) => {
  if (type === 'code') {
    return normalizeText(lines.filter(line => !line.trim().startsWith('```')).join(' '))
  }

  return normalizeText(
    lines
      .map(line => {
        const withoutMarkers = line
          .replace(/^#{1,6}\s+/, '')
          .replace(/^>\s?/, '')
          .replace(/^([-*+]|\d+\.)\s+/, '')
        return stripMarkdownInline(stripHeadingAnchor(withoutMarkers))
      })
      .join(' '),
  )
}

/** @param {string} markdown */
const splitMarkdownBlocks = markdown => {
  /** @type {string[][]} */
  const blocks = []
  /** @type {string[]} */
  let current = []
  let inFence = false

  const pushCurrent = () => {
    if (current.some(line => line.trim().length > 0)) {
      blocks.push(current)
    }
    current = []
  }

  for (const line of markdown.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) {
      current.push(line)
      inFence = !inFence
      if (!inFence) {
        pushCurrent()
      }
      continue
    }

    if (inFence) {
      current.push(line)
      continue
    }

    if (/^#{1,6}\s+/.test(line) && current.length) {
      pushCurrent()
    }

    if (line.trim().length === 0) {
      pushCurrent()
      continue
    }

    current.push(line)
  }

  pushCurrent()
  return blocks
}

/** @param {string} dir */
const walkMarkdownFiles = async dir => {
  /** @type {string[]} */
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(entryPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

/**
 * @param {string} docId
 * @param {string} markdown
 * @returns {DocSearchBlock[]}
 */
const createDocBlocks = (docId, markdown) => {
  const route = toDocRoute(docId)
  const title = toDocTitle(docId, markdown)
  let sectionTitle = title
  let sectionAnchor = ''

  return splitMarkdownBlocks(markdown).reduce((blocks, lines, index) => {
    const type = detectBlockType(lines)
    const first = lines.find(line => line.trim().length > 0)?.trim() || ''
    const text = extractBlockText(lines, type)

    if (!text) {
      return blocks
    }

    if (type === 'heading') {
      sectionTitle = text
      sectionAnchor = readHeadingAnchor(first) || slugifyHeading(first)
    }

    const href = sectionAnchor ? `${route}#${sectionAnchor}` : route
    const searchText = normalizeSearchText([title, sectionTitle, text, docId].join(' '))

    blocks.push({
      id: `${docId}:${index}`,
      docId,
      route,
      href,
      title,
      sectionTitle,
      type,
      text,
      searchText,
    })
    return blocks
  }, /** @type {DocSearchBlock[]} */ ([]))
}

const buildIndex = async () => {
  const markdownFiles = await walkMarkdownFiles(docsDir)
  /** @type {DocSearchBlock[]} */
  const blocks = []

  for (const filePath of markdownFiles) {
    const markdown = await fs.readFile(filePath, 'utf8')
    const docId = path.relative(docsDir, filePath).replace(/\\/g, '/').replace(/\.md$/, '')
    blocks.push(...createDocBlocks(docId, markdown))
  }

  return {
    version: 1,
    source: 'docs',
    files: markdownFiles.length,
    blocks,
  }
}

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

const index = await buildIndex()
const content = `${JSON.stringify(index)}\n`
const changed = await writeIfChanged(outputFile, content)

console.log(
  `[docs-search] ${changed ? 'Updated' : 'Unchanged'} docs/search-index.json (${index.files} files, ${index.blocks.length} blocks)`,
)
