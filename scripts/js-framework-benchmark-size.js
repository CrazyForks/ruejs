// @ts-check
import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

export const BENCHMARK_GZIP_LIMIT = 16 * 1024

const forbiddenModulePattern =
  /runtime\.internal\.esm-bundler|runtime-core\/js-reactive|runtime\.(?:server|island)\.esm-bundler|server-renderer|runtime-vapor|\.wasm(?:$|\?)/i

export class BenchmarkSizeBudgetError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'BenchmarkSizeBudgetError'
  }
}

/**
 * @param {string} entry
 * @param {Array<{fileName: string, imports: string[], rawBytes: number, gzipBytes: number, moduleIds?: string[]}>} assets
 */
export function measureStaticJavaScriptClosure(entry, assets) {
  const byName = new Map(assets.map(asset => [asset.fileName, asset]))
  const visited = new Set()
  /** @param {string} fileName */
  const visit = fileName => {
    if (visited.has(fileName)) return
    const asset = byName.get(fileName)
    if (!asset) {
      throw new BenchmarkSizeBudgetError(`Missing static JavaScript dependency: ${fileName}`)
    }
    visited.add(fileName)
    for (const dependency of asset.imports) visit(dependency)
  }
  visit(entry)

  const files = [...visited].sort()
  const selected = files.map(fileName => byName.get(fileName))
  const forbidden = selected
    .flatMap(asset => asset?.moduleIds ?? [])
    .filter(id => forbiddenModulePattern.test(id))
  if (forbidden.length > 0) {
    throw new BenchmarkSizeBudgetError(
      `Forbidden moduleIds in rue-signal bundle: ${forbidden.join(', ')}`,
    )
  }
  const result = {
    entry,
    files,
    rawBytes: selected.reduce((total, asset) => total + (asset?.rawBytes ?? 0), 0),
    gzipBytes: selected.reduce((total, asset) => total + (asset?.gzipBytes ?? 0), 0),
  }
  if (result.gzipBytes > BENCHMARK_GZIP_LIMIT) {
    throw new BenchmarkSizeBudgetError(
      `rue-signal JavaScript gzip ${result.gzipBytes} B exceeds ${BENCHMARK_GZIP_LIMIT} B`,
    )
  }
  return result
}

const staticImportPattern =
  /(?:import\s+(?:[^'";]*?\s+from\s+)?|export\s+[^'";]*?\s+from\s+)["']([^"']+\.js)["']/g

/** @param {string} code */
function staticImports(code) {
  return [...code.matchAll(staticImportPattern)].map(match => match[1])
}

/** @param {string} distDirectory */
export async function auditBuiltBenchmark(distDirectory) {
  const entry = 'main.js'
  const pending = [entry]
  const assets = []
  const visited = new Set()
  while (pending.length > 0) {
    const fileName = pending.pop()
    if (!fileName || visited.has(fileName)) continue
    visited.add(fileName)
    const filePath = path.resolve(distDirectory, fileName)
    const bytes = await fs.readFile(filePath)
    const code = bytes.toString('utf8')
    const imports = staticImports(code)
      .filter(specifier => specifier.startsWith('.'))
      .map(specifier =>
        path.posix.normalize(path.posix.join(path.posix.dirname(fileName), specifier)),
      )
    assets.push({
      fileName,
      imports,
      rawBytes: bytes.byteLength,
      gzipBytes: gzipSync(bytes).byteLength,
    })
    pending.push(...imports)
  }
  return measureStaticJavaScriptClosure(entry, assets)
}
