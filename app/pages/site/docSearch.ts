export type DocSearchBlockType = 'heading' | 'paragraph' | 'list' | 'code' | 'blockquote' | 'table'

export type DocSearchBlock = {
  id: string
  docId: string
  route: string
  href: string
  title: string
  sectionTitle: string
  type: DocSearchBlockType
  text: string
  searchText: string
}

export type DocSearchIndex = {
  version: number
  source: string
  files: number
  blocks: DocSearchBlock[]
}

export type DocSearchResult = DocSearchBlock & {
  score: number
  snippet: string
}

const MAX_RESULTS = 12
const MIN_QUERY_LENGTH = 2
const DOC_SEARCH_INDEX_URL = '/docs/search-index.json'

let docSearchIndexPromise: Promise<DocSearchIndex> | null = null

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeSearchText = (value: string) => normalizeText(value).toLowerCase()

const loadDocSearchIndex = async () => {
  if (!docSearchIndexPromise) {
    docSearchIndexPromise = fetch(DOC_SEARCH_INDEX_URL)
      .then(res => {
        if (!res.ok) {
          throw new Error(`doc search index not found: ${res.status}`)
        }
        return res.json() as Promise<DocSearchIndex>
      })
      .then(index => ({
        ...index,
        blocks: Array.isArray(index.blocks) ? index.blocks : [],
      }))
  }

  return docSearchIndexPromise
}

const scoreBlock = (block: DocSearchBlock, terms: string[]) => {
  return terms.reduce((score, term) => {
    if (!block.searchText.includes(term)) {
      return -Infinity
    }

    let nextScore = score + 1
    if (block.title.toLowerCase().includes(term)) nextScore += 4
    if (block.sectionTitle.toLowerCase().includes(term)) nextScore += 3
    if (block.text.toLowerCase().startsWith(term)) nextScore += 2
    if (block.type === 'heading') nextScore += 1
    return nextScore
  }, 0)
}

const createSnippet = (text: string, terms: string[]) => {
  const lowerText = text.toLowerCase()
  const matchIndex = terms.reduce((found, term) => {
    const index = lowerText.indexOf(term)
    return index >= 0 && (found < 0 || index < found) ? index : found
  }, -1)

  if (matchIndex < 0) {
    return text.length > 140 ? `${text.slice(0, 140)}...` : text
  }

  const start = Math.max(0, matchIndex - 48)
  const end = Math.min(text.length, matchIndex + 112)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`
}

export const searchDocBlocks = async (
  query: string,
  limit = MAX_RESULTS,
): Promise<DocSearchResult[]> => {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean)
  const normalizedLength = terms.join('').length

  if (normalizedLength < MIN_QUERY_LENGTH) {
    return []
  }

  const index = await loadDocSearchIndex()

  return index.blocks
    .map(block => {
      const score = scoreBlock(block, terms)
      return {
        ...block,
        score,
        snippet: createSnippet(block.text, terms),
      }
    })
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}
