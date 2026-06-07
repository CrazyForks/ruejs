type CssVirtual = {
  id: string
  type: 'ssr' | 'rsc'
}

export const RUE_RSC_VIRTUAL_PREFIX = 'virtual:rue-rsc/'
export const VITE_RSC_VIRTUAL_PREFIX = 'virtual:vite-rsc/'
export const RUE_RSC_RESOLVED_VIRTUAL_PREFIX = '\0virtual:rue-rsc/'
export const VITE_RSC_RESOLVED_VIRTUAL_PREFIX = '\0virtual:vite-rsc/'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function toRueRscVirtualId(path: string): string {
  return RUE_RSC_VIRTUAL_PREFIX + path
}

export function toViteRscVirtualId(path: string): string {
  return VITE_RSC_VIRTUAL_PREFIX + path
}

export function normalizeRscVirtualId(id: string): string {
  if (id.startsWith(RUE_RSC_VIRTUAL_PREFIX) || id.startsWith(RUE_RSC_RESOLVED_VIRTUAL_PREFIX)) {
    return id
  }
  if (id.startsWith(VITE_RSC_VIRTUAL_PREFIX)) {
    return RUE_RSC_VIRTUAL_PREFIX + id.slice(VITE_RSC_VIRTUAL_PREFIX.length)
  }
  if (id.startsWith(VITE_RSC_RESOLVED_VIRTUAL_PREFIX)) {
    return RUE_RSC_RESOLVED_VIRTUAL_PREFIX + id.slice(VITE_RSC_RESOLVED_VIRTUAL_PREFIX.length)
  }
  return id
}

export function rscVirtualExactRegex(path: string): RegExp {
  const escapedPath = escapeRegExp(path)
  return new RegExp(`^virtual:(?:rue-rsc|vite-rsc)/${escapedPath}$`)
}

export function rscResolvedVirtualExactRegex(path: string): RegExp {
  const escapedPath = escapeRegExp(path)
  return new RegExp(`^\\0virtual:(?:rue-rsc|vite-rsc)/${escapedPath}$`)
}

export function rscVirtualPrefixRegex(path: string): RegExp {
  const escapedPath = escapeRegExp(path)
  return new RegExp(`^virtual:(?:rue-rsc|vite-rsc)/${escapedPath}`)
}

export function rscResolvedVirtualPrefixRegex(path: string): RegExp {
  const escapedPath = escapeRegExp(path)
  return new RegExp(`^\\0virtual:(?:rue-rsc|vite-rsc)/${escapedPath}`)
}

export function toCssVirtual({ id, type }: CssVirtual) {
  // ensure other plugins treat it as a plain js file
  // e.g. https://github.com/vitejs/rolldown-vite/issues/372#issuecomment-3193401601
  return `${RUE_RSC_VIRTUAL_PREFIX}css?type=${type}&id=${encodeURIComponent(id)}&lang.js`
}

export function parseCssVirtual(id: string): CssVirtual | undefined {
  id = normalizeRscVirtualId(id)
  if (id.startsWith(`${RUE_RSC_RESOLVED_VIRTUAL_PREFIX}css?`)) {
    const { id: sourceId, type } = parseIdQuery(id).query
    if (type === 'ssr' || type === 'rsc') {
      return { id: sourceId, type }
    }
  }
}

// https://github.com/vitejs/vite-plugin-vue/blob/06931b1ea2b9299267374cb8eb4db27c0626774a/packages/plugin-vue/src/utils/query.ts#L13
export function parseIdQuery(id: string): {
  filename: string
  query: {
    [k: string]: string
  }
} {
  if (!id.includes('?')) return { filename: id, query: {} }
  const [filename, rawQuery] = id.split(`?`, 2) as [string, string]
  const query = Object.fromEntries(new URLSearchParams(rawQuery))
  return { filename, query }
}

export type ReferenceValidationVirtual = {
  id: string
  type: 'server' | 'client'
}

export function toReferenceValidationVirtual({ id, type }: ReferenceValidationVirtual) {
  return `${RUE_RSC_VIRTUAL_PREFIX}reference-validation?type=${type}&id=${encodeURIComponent(id)}&lang.js`
}

export function parseReferenceValidationVirtual(
  id: string,
): ReferenceValidationVirtual | undefined {
  id = normalizeRscVirtualId(id)
  if (id.startsWith(`${RUE_RSC_RESOLVED_VIRTUAL_PREFIX}reference-validation?`)) {
    const { id: sourceId, type } = parseIdQuery(id).query
    if (type === 'server' || type === 'client') {
      return { id: sourceId, type }
    }
  }
}
