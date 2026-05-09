import MagicString from 'magic-string'

/**
 * @param {Record<string, string>} values
 */
export function createLiteralReplacePlugin(values) {
  const replacements = Object.entries(values)
    .filter(([search, replacement]) => search.length > 0 && replacement !== search)
    .sort((left, right) => right[0].length - left[0].length)

  return {
    name: 'rue-literal-replace',
    enforce: 'pre',
    transform(code) {
      let magic = null

      for (const [search, replacement] of replacements) {
        let searchStart = 0

        while (searchStart < code.length) {
          const matchIndex = code.indexOf(search, searchStart)
          if (matchIndex < 0) {
            break
          }

          magic ||= new MagicString(code)
          magic.overwrite(matchIndex, matchIndex + search.length, replacement)
          searchStart = matchIndex + search.length
        }
      }

      if (!magic) {
        return null
      }

      return {
        code: magic.toString(),
        map: null,
      }
    },
  }
}
