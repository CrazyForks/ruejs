// @ts-check
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const forbidden = Object.freeze([
  /@rue-js\/runtime-vapor/g,
  /@rue-js\/rue\/vapor/g,
  /runtime\.vapor/g,
  /rue\.vapor/g,
  /_\$vapor[A-Za-z0-9_]*/g,
  /__rue_(?:runtime_)?vapor[A-Za-z0-9_]*/g,
  /vapor-helpers/g,
])
const roots = Object.freeze(['packages', 'app', 'scripts'])
const extensions = /\.(?:[cm]?[jt]sx?|rs|json|ya?ml)$/

/** @param {string} root @param {string} relative @returns {Promise<string[]>} */
async function files(root, relative) {
  let entries
  try {
    entries = await readdir(path.resolve(root, relative), { withFileTypes: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
  return (
    await Promise.all(
      entries.map(async entry => {
        const next = path.join(relative, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'temp', 'coverage', 'target'].includes(entry.name)) return []
          return files(root, next)
        }
        return entry.isFile() && extensions.test(entry.name) ? [next] : []
      }),
    )
  ).flat()
}

/** @param {string} root */
export async function scanCompilerRuntimeBoundary(root) {
  const candidates = new Set(['package.json', 'pnpm-lock.yaml'])
  for (const directory of roots)
    for (const file of await files(root, directory)) candidates.add(file)
  const violations = []
  for (const relative of [...candidates].sort()) {
    if (relative === 'scripts/check-compiler-runtime-boundary.js' || relative.includes('__tests__'))
      continue
    let content
    try {
      content = await readFile(path.resolve(root, relative), 'utf8')
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue
      throw error
    }
    for (const pattern of forbidden) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        const line = content.slice(0, match.index).split('\n').length
        violations.push({ file: relative.split(path.sep).join('/'), line, token: match[0] })
      }
    }
  }
  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

/** @param {Array<{file: string, line: number, token: string}>} violations */
export function assertCompilerRuntimeBoundary(violations) {
  if (!violations.length) return
  throw new Error(
    `compiler/runtime boundary check failed:\n${violations.map(v => `- ${v.file}:${v.line} contains ${v.token}`).join('\n')}`,
  )
}

const moduleFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === moduleFile) {
  const { values } = parseArgs({ options: { root: { type: 'string', default: process.cwd() } } })
  assertCompilerRuntimeBoundary(await scanCompilerRuntimeBoundary(path.resolve(values.root)))
  console.log('Compiler/runtime boundary: clean')
}
