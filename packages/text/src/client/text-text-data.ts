/**
 * text-specific extensions to Text.js's `TEXT_DATA`.
 *
 * The `text` package declares `Window.__TEXT_DATA__: TEXT_DATA` in its types.
 * We can't augment the `TEXT_DATA` type alias, so we extend the text shim's
 * interface (shims/internal/utils.ts) and cast at the usage sites.
 */
import type { TEXT_DATA } from '../shims/internal/utils.js'
import { isUnknownRecord } from '../utils/record.js'

export type TextLinkPrefetchRoute = {
  canPrefetchLoadingShell: boolean
  isDynamic: boolean
  patternParts: string[]
}

export type TextTextData = {
  /** text-specific additions (not part of Text.js upstream). */
  __text?: {
    /** Absolute URL of the page module for dynamic import. */
    pageModuleUrl?: string
    /** Absolute URL of the `_app` module for dynamic import. */
    appModuleUrl?: string
    /** True when the Pages Router server has middleware/proxy configured. */
    hasMiddleware?: boolean
  }
} & TEXT_DATA

type BrowserTextTextData = NonNullable<Window['__TEXT_DATA__']> & TextTextData

type TextLocaleGlobalTarget = {
  __TEXT_LOCALE__: string | undefined
  __TEXT_LOCALES__: string[] | undefined
  __TEXT_DEFAULT_LOCALE__: string | undefined
}

export function extractTextTextDataJson(html: string): string | null {
  const assignment = /<script(?:\s[^>]*)?>\s*window\.__TEXT_DATA__\s*=\s*/.exec(html)
  if (!assignment || assignment.index === undefined) return null

  let start = assignment.index + assignment[0].length
  while (
    html[start] === ' ' ||
    html[start] === '\n' ||
    html[start] === '\t' ||
    html[start] === '\r'
  ) {
    start++
  }
  if (html[start] !== '{') return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < html.length; index++) {
    const char = html[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) return html.slice(start, index + 1)
    }
  }

  return null
}

export function parseTextTextDataJson(json: string): BrowserTextTextData {
  const parsed: unknown = JSON.parse(json)
  if (!isBrowserTextTextData(parsed)) {
    throw new Error('Navigation failed: invalid __TEXT_DATA__ in response')
  }
  return parsed
}

function isBrowserTextTextData(value: unknown): value is BrowserTextTextData {
  if (!isUnknownRecord(value)) return false

  const props = value.props
  const page = value.page
  const query = value.query
  const text = value.__text

  return (
    isUnknownRecord(props) &&
    typeof page === 'string' &&
    isUnknownRecord(query) &&
    (text === undefined || isUnknownRecord(text))
  )
}

export function applyTextLocaleGlobals(
  target: TextLocaleGlobalTarget,
  textData: TextTextData,
): void {
  if (textData.locale !== undefined) {
    target.__TEXT_LOCALE__ = textData.locale
  }
  if (textData.locales !== undefined) {
    target.__TEXT_LOCALES__ = [...textData.locales]
  }
  if (textData.defaultLocale !== undefined) {
    target.__TEXT_DEFAULT_LOCALE__ = textData.defaultLocale
  }
}
