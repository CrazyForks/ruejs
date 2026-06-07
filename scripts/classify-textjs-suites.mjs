import fs from 'node:fs'
import path from 'node:path'

const APP_ROUTER_NON_APP_DIR_SUITES = new Set([
  'test/e2e/text-form/default/text-form-prefetch.test.ts',
])

const ROUTE_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'])
const APP_ROUTE_NAMES = new Set(['page', 'layout', 'route', 'default'])
const PAGES_SPECIAL_FILES = new Set(['_app', '_document', '_error'])
const IGNORED_DIRS = new Set(['node_modules', '.text', '.git', 'dist', 'coverage'])

export function classifySuite(textRoot, suitePath, overrides = {}) {
  const normalizedSuite = normalizePath(suitePath)
  const override = overrides[normalizedSuite] ?? overrides[suitePath]
  if (override) return override

  if (APP_ROUTER_NON_APP_DIR_SUITES.has(normalizedSuite)) {
    return 'app'
  }

  const suiteAbs = path.resolve(textRoot, normalizedSuite)
  const suiteExists = fs.existsSync(suiteAbs)
  if (!suiteExists) {
    return isAppDirSuite(normalizedSuite) ? 'app' : 'unknown'
  }

  for (const fixtureRoot of candidateFixtureRoots(suiteAbs)) {
    const result = scanFixture(fixtureRoot)
    if (result !== 'unknown') return result
  }

  return isAppDirSuite(normalizedSuite) ? 'app' : 'unknown'
}

function normalizePath(value) {
  return value.split(path.sep).join('/')
}

function isAppDirSuite(suitePath) {
  return suitePath.includes('/app-dir/') || suitePath.startsWith('test/e2e/app-dir/')
}

function candidateFixtureRoots(suiteAbs) {
  const suiteDir = path.dirname(suiteAbs)
  const roots = []
  if (path.basename(suiteDir) === 'test') {
    roots.push(path.dirname(suiteDir))
  }
  roots.push(suiteDir)
  return [...new Set(roots)]
}

function scanFixture(root) {
  const appWrapper = path.join(root, 'app')
  if (isProjectWrapper(appWrapper)) {
    return scanProjectRoot(appWrapper)
  }

  const direct = scanProjectRoot(root)
  if (direct !== 'unknown') return direct

  return 'unknown'
}

function scanProjectRoot(root) {
  const hasApp = hasRealAppRoutes(path.join(root, 'app'))
  const hasPages = hasRealPagesRoutes(path.join(root, 'pages'))

  if (hasApp && hasPages) return 'both'
  if (hasApp) return 'app'
  if (hasPages) return 'pages'
  return 'unknown'
}

function isProjectWrapper(dir) {
  if (!isDirectory(dir)) return false
  return [
    'text.config.js',
    'text.config.mjs',
    'text.config.ts',
    'text.config.cjs',
    'text.config.js',
    'text.config.mjs',
    'text.config.ts',
    'text.config.cjs',
  ].some(file => fs.existsSync(path.join(dir, file)))
}

function hasRealAppRoutes(appDir) {
  return scanFiles(appDir, file => {
    const name = path.basename(file).split('.')[0]
    return APP_ROUTE_NAMES.has(name) && hasRouteExtension(file)
  })
}

function hasRealPagesRoutes(pagesDir) {
  return scanFiles(pagesDir, file => {
    if (!hasRouteExtension(file)) return false
    const name = path.basename(file).split('.')[0]
    return !PAGES_SPECIAL_FILES.has(name)
  })
}

function scanFiles(root, predicate) {
  if (!isDirectory(root)) return false

  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.isFile() && predicate(entryPath)) {
        return true
      }
    }
  }

  return false
}

function hasRouteExtension(file) {
  const parts = path.basename(file).split('.')
  return parts.length > 1 && ROUTE_EXTENSIONS.has(parts.at(-1))
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory()
  } catch {
    return false
  }
}
