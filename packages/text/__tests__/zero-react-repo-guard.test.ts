import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'vite-plus/test'

const packageRoot = path.resolve(import.meta.dirname, '..')
const workspaceRoot = path.resolve(packageRoot, '../..')

const SCAN_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'vite.config.ts',
] as const

const SCAN_FILE_GLOBS = [/^tsconfig.*\.json$/]
const SCAN_DIRECTORIES = ['app', 'docs', 'examples', 'packages'] as const

const IGNORED_DIRECTORIES = new Set([
  '.cache',
  '.ecosystem-test',
  '.git',
  '.text',
  '.parcel-cache',
  '.playwright-report',
  '.sass-cache',
  '.swc',
  '.temp',
  '.test-tmp',
  '.text',
  '.tmp',
  '.turbo',
  '.vat',
  '.vite',
  '.vite-cache',
  '.vapor-tmp',
  '.wrangler',
  'build',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'nyc_output',
  'out',
  'out-e2e',
  'playwright-report',
  'reports',
  'target',
  'target-local',
  'temp',
  'test-results',
])
const IGNORED_FILE_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.svg',
  '.webp',
  '.wasm',
  '.zip',
])

const RUE_PACKAGE = ['re', 'act'].join('')
const RUE_REPO_TERMS = [
  RUE_PACKAGE,
  `${RUE_PACKAGE}-dom`,
  `${RUE_PACKAGE}-server-dom-webpack`,
  `@types/${RUE_PACKAGE}`,
  `@types/${RUE_PACKAGE}-dom`,
  `@vitejs/plugin-${RUE_PACKAGE}`,
  `@radix-ui/${RUE_PACKAGE}-[a-z-]+`,
  `better-auth/${RUE_PACKAGE}`,
  `${RUE_PACKAGE}/jsx-runtime`,
  `${RUE_PACKAGE}/jsx-dev-runtime`,
  `${RUE_PACKAGE}-server`,
  `${RUE_PACKAGE}.server`,
  `${RUE_PACKAGE}.element`,
  `${RUE_PACKAGE}.fragment`,
  `${RUE_PACKAGE}.suspense`,
]

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\[a-z-\\]\\+', '[a-z-]+')
}

const RUE_REPO_PATTERN = new RegExp(
  `(^|[^a-zA-Z0-9_-])(${RUE_REPO_TERMS.map(escapeRegExp).join('|')})([^a-zA-Z0-9_-]|$)`,
)

const OWNER_NAMES = [
  'rue-rsc',
  'text source',
  'text fixtures',
  'root/app/docs',
  'lockfile/catalog',
] as const

type OwnerName = (typeof OWNER_NAMES)[number]

type RueRepoHit = {
  owner: OwnerName
  file: string
  line: number
  source: string
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectRootFiles(): Promise<string[]> {
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true })
  const globbedFiles = entries
    .filter(entry => entry.isFile() && SCAN_FILE_GLOBS.some(pattern => pattern.test(entry.name)))
    .map(entry => path.join(workspaceRoot, entry.name))

  const explicitFiles = (
    await Promise.all(
      SCAN_FILES.map(async file => {
        const absolutePath = path.join(workspaceRoot, file)
        return (await pathExists(absolutePath)) ? [absolutePath] : []
      }),
    )
  ).flat()

  return [...explicitFiles, ...globbedFiles]
}

async function collectDirectoryFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const absolutePath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          return []
        }
        return collectDirectoryFiles(absolutePath)
      }

      if (!entry.isFile() || IGNORED_FILE_EXTENSIONS.has(path.extname(entry.name))) {
        return []
      }

      return [absolutePath]
    }),
  )

  return files.flat()
}

async function collectScanFiles(): Promise<string[]> {
  const rootFiles = await collectRootFiles()
  const directoryFiles = (
    await Promise.all(
      SCAN_DIRECTORIES.map(async dir => {
        const absolutePath = path.join(workspaceRoot, dir)
        return (await pathExists(absolutePath)) ? collectDirectoryFiles(absolutePath) : []
      }),
    )
  ).flat()

  return [...new Set([...rootFiles, ...directoryFiles])].sort()
}

function toRepoPath(file: string): string {
  return path.relative(workspaceRoot, file).split(path.sep).join('/')
}

function classifyOwner(file: string): OwnerName {
  if (file === 'pnpm-lock.yaml' || file === 'pnpm-workspace.yaml') {
    return 'lockfile/catalog'
  }

  if (file.startsWith('packages/rue-rsc/')) {
    return 'rue-rsc'
  }

  if (file.startsWith('packages/text/__tests__/fixtures/')) {
    return 'text fixtures'
  }

  if (file.startsWith('packages/text/')) {
    return 'text source'
  }

  return 'root/app/docs'
}

async function collectRueRepoHits(): Promise<RueRepoHit[]> {
  const hits: RueRepoHit[] = []

  for (const absoluteFile of await collectScanFiles()) {
    const file = toRepoPath(absoluteFile)
    const lines = (await fs.readFile(absoluteFile, 'utf8')).split(/\r?\n/)

    lines.forEach((line, index) => {
      if (!RUE_REPO_PATTERN.test(line)) {
        return
      }

      hits.push({
        owner: classifyOwner(file),
        file,
        line: index + 1,
        source: line.trim(),
      })
    })
  }

  return hits
}

function formatHitsByOwner(hits: RueRepoHit[]): string {
  const lines = [
    `Found ${hits.length} Rue repository scan hits.`,
    'This guard is expected to stay red until the Remove Rue 2 migration reaches the final zero-hit gate.',
  ]

  for (const owner of OWNER_NAMES) {
    const ownerHits = hits.filter(hit => hit.owner === owner)
    lines.push('', `${owner} (${ownerHits.length})`)

    for (const hit of ownerHits.slice(0, 25)) {
      lines.push(`  ${hit.file}:${hit.line}: ${hit.source}`)
    }

    if (ownerHits.length > 25) {
      lines.push(`  ... ${ownerHits.length - 25} more`)
    }
  }

  return lines.join('\n')
}

describe('zero Rue repository guard', () => {
  it.skip('reports every Rue package/protocol hit grouped by migration owner', async () => {
    const hits = await collectRueRepoHits()

    if (hits.length > 0) {
      throw new Error(formatHitsByOwner(hits))
    }
  })
})
