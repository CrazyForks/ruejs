// @ts-check

import fs from 'node:fs/promises'
import path from 'node:path'

export const DOC_SOURCE_EXTENSIONS = ['.md', '.mdx']

const DOC_SOURCE_EXTENSION_SET = new Set(DOC_SOURCE_EXTENSIONS)

/**
 * @typedef {'.md' | '.mdx'} DocSourceExtension
 * @typedef {'heading' | 'paragraph' | 'list' | 'code' | 'blockquote' | 'table'} DocSearchBlockType
 * @typedef {{
 *   filePath: string
 *   docId: string
 *   extension: DocSourceExtension
 *   route: string
 * }} DocSource
 * @typedef {DocSource & {
 *   content: string
 * }} ParsedDocSource
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

/** @param {string} value */
const normalizeSearchText = value => normalizeText(value).toLowerCase()

/** @param {string} value */
const stripMarkdownInline = value =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]+>/g, '')

const HEADING_ANCHOR_SUFFIX_RE =
  /\s*(?:\{#([-\w\u4e00-\u9fff]+)\}|\{\/\*\s*#([-\w\u4e00-\u9fff]+)\s*\*\/\})\s*$/u

/** @param {string} value */
const stripHeadingAnchor = value => value.replace(HEADING_ANCHOR_SUFFIX_RE, '')

/** @param {string} value */
const readHeadingAnchor = value => {
  const match = value.match(HEADING_ANCHOR_SUFFIX_RE)
  return match?.[1] || match?.[2] || ''
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

/** @param {string} filePath */
export const isDocSourceFile = filePath => DOC_SOURCE_EXTENSION_SET.has(path.extname(filePath))

/** @param {string} docId */
export const toDocRoute = docId => {
  if (docId.startsWith('guide/')) {
    return `/guide/${docId}`
  }

  if (docId.startsWith('api/')) {
    return `/api/${docId}`
  }

  return `/page/${docId}`
}

/**
 * @param {string} docsDir
 * @param {string} filePath
 */
export const toDocId = (docsDir, filePath) => {
  const extension = path.extname(filePath)
  if (!DOC_SOURCE_EXTENSION_SET.has(extension)) {
    throw new Error(`Unsupported doc source extension "${extension}" for ${filePath}`)
  }

  return path
    .relative(docsDir, filePath)
    .replace(/\\/g, '/')
    .replace(/\.(?:md|mdx)$/, '')
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

/** @param {string} line */
const countDelimiterDelta = line => {
  const matches = line.match(/[{}[\]()]/g) || []
  return matches.reduce((total, delimiter) => {
    return total + ('{[('.includes(delimiter) ? 1 : -1)
  }, 0)
}

/** @param {string} line */
const isMdxEsmStart = line => /^(?:import|export)\s/.test(line)

/** @param {string} line */
const isMdxJsxTagStart = line => /^<\/?[A-Z][\w.:-]*(?:\s|>|$)/.test(line)

/** @param {string} line */
const isCompleteMdxJsxTag = line => /^<\/?[A-Z][\w.:-]*(?:\s[^>]*)?\/?>$/.test(line)

/**
 * @param {string} source
 * @param {DocSourceExtension} extension
 */
const prepareDocSearchSource = (source, extension) => {
  if (extension !== '.mdx') {
    return source
  }

  /** @type {string[]} */
  const lines = []
  let inFence = false
  let inEsmBlock = false
  let esmBraceDepth = 0
  let inJsxTag = false

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      lines.push(line)
      inFence = !inFence
      continue
    }

    if (inFence) {
      lines.push(line)
      continue
    }

    if (inEsmBlock) {
      esmBraceDepth += countDelimiterDelta(line)
      if (esmBraceDepth <= 0) {
        inEsmBlock = false
        esmBraceDepth = 0
      }
      continue
    }

    if (inJsxTag) {
      if (trimmed.includes('>')) {
        inJsxTag = false
      }
      continue
    }

    if (isMdxEsmStart(trimmed)) {
      esmBraceDepth = countDelimiterDelta(line)
      inEsmBlock = esmBraceDepth > 0
      continue
    }

    if (isMdxJsxTagStart(trimmed) && (isCompleteMdxJsxTag(trimmed) || !trimmed.includes('>'))) {
      inJsxTag = !trimmed.includes('>')
      continue
    }

    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * @param {string} docId
 * @param {string} source
 * @param {{ extension?: DocSourceExtension }} [options]
 * @returns {DocSearchBlock[]}
 */
export const createDocBlocks = (docId, source, options = {}) => {
  const extension = options.extension || '.md'
  const markdown = prepareDocSearchSource(source, extension)
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

/** @param {string} dir */
export const walkDocSourceFiles = async dir => {
  /** @type {string[]} */
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkDocSourceFiles(entryPath)))
      continue
    }

    if (entry.isFile() && isDocSourceFile(entry.name)) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

/** @param {string} docsDir */
export const findDocSources = async docsDir => {
  const files = await walkDocSourceFiles(docsDir)
  /** @type {Map<string, DocSource>} */
  const sourcesByDocId = new Map()

  for (const filePath of files) {
    const extension = /** @type {DocSourceExtension} */ (path.extname(filePath))
    const docId = toDocId(docsDir, filePath)
    const previous = sourcesByDocId.get(docId)

    if (previous) {
      throw new Error(`Duplicate doc source for "${docId}": ${previous.filePath} and ${filePath}`)
    }

    sourcesByDocId.set(docId, {
      filePath,
      docId,
      extension,
      route: toDocRoute(docId),
    })
  }

  return [...sourcesByDocId.values()]
}

/**
 * @param {string} _docsDir
 * @param {DocSource} source
 * @returns {Promise<ParsedDocSource>}
 */
export const readDocSource = async (_docsDir, source) => ({
  ...source,
  content: await fs.readFile(source.filePath, 'utf8'),
})

/** @param {string} docsDir */
export const buildDocSearchIndex = async docsDir => {
  const sources = await findDocSources(docsDir)
  /** @type {DocSearchBlock[]} */
  const blocks = []

  for (const source of sources) {
    const parsed = await readDocSource(docsDir, source)
    blocks.push(...createDocBlocks(parsed.docId, parsed.content, { extension: parsed.extension }))
  }

  return {
    version: 1,
    source: 'docs',
    files: sources.length,
    blocks,
  }
}
