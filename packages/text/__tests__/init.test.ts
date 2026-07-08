import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  decodeRuePayloadReadableStream,
  renderRuePayloadToReadableStream,
} from '@rue-js/rsc/core/payload'
import {
  init,
  generateViteConfig,
  addScripts,
  getInitDeps,
  isDepInstalled,
  updateGitignore,
  type InitOptions,
} from '../src/init.js'

// ─── Test Helpers ────────────────────────────────────────────────────────────

let tmpDir: string
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'text-init-test-'))
}

function writeFile(dir: string, relativePath: string, content: string): void {
  const fullPath = path.join(dir, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
}

function mkdir(dir: string, relativePath: string): void {
  fs.mkdirSync(path.join(dir, relativePath), { recursive: true })
}

function readPkg(dir: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
}

function readFile(dir: string, relativePath: string): string {
  return fs.readFileSync(path.join(dir, relativePath), 'utf-8')
}

function readRueRscPayloadSource(): string {
  return fs.readFileSync(path.resolve(packageRoot, '../rue-rsc/src/core/payload.ts'), 'utf-8')
}

/**
 * Create a minimal Text.js-like project structure in a temp directory.
 */
function setupProject(
  dir: string,
  opts: {
    router?: 'app' | 'pages'
    typeModule?: boolean
    extraPkg?: Record<string, unknown>
  } = {},
): void {
  const router = opts.router ?? 'app'
  const pkg: Record<string, unknown> = {
    name: 'test-project',
    version: '1.0.0',
    dependencies: { '@rue-js/text': 'workspace:*', text: '^15.0.0' },
    ...opts.extraPkg,
  }
  if (opts.typeModule) {
    pkg.type = 'module'
  }

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2))

  if (router === 'app') {
    mkdir(dir, 'app')
    writeFile(dir, 'app/page.tsx', 'export default function Home() { return <div>hi</div> }')
    writeFile(
      dir,
      'app/layout.tsx',
      'export default function Layout({ children }) { return <html><body>{children}</body></html> }',
    )
  } else {
    mkdir(dir, 'pages')
    writeFile(dir, 'pages/index.tsx', 'export default function Home() { return <div>hi</div> }')
  }
}

/** No-op exec for tests — records calls for assertions */
function noopExec(): {
  exec: (cmd: string, opts: { cwd: string; stdio: string }) => void
  calls: Array<{ cmd: string; opts: { cwd: string; stdio: string } }>
} {
  const calls: Array<{ cmd: string; opts: { cwd: string; stdio: string } }> = []
  return {
    exec: (cmd: string, opts: { cwd: string; stdio: string }) => {
      calls.push({ cmd, opts })
    },
    calls,
  }
}

/**
 * Run init with a no-op exec and suppressed console output.
 */
async function runInit(
  dir: string,
  opts: Partial<InitOptions> = {},
): Promise<{ result: Awaited<ReturnType<typeof init>>; execCalls: Array<{ cmd: string }> }> {
  const { exec, calls } = noopExec()

  // Suppress console output during tests
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  // Mock process.exit to prevent test from exiting
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit(${code})`)
  }) as never)

  try {
    const result = await init({
      root: dir,
      skipCheck: true,
      _exec: exec,
      ...opts,
    })
    return { result, execCalls: calls }
  } finally {
    consoleSpy.mockRestore()
    consoleErrSpy.mockRestore()
    exitSpy.mockRestore()
  }
}

/**
 * Run init expecting it to fail (process.exit).
 */
async function runInitExpectExit(dir: string, opts: Partial<InitOptions> = {}): Promise<string> {
  const { exec } = noopExec()

  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit(${code})`)
  }) as never)

  try {
    await init({
      root: dir,
      skipCheck: true,
      _exec: exec,
      ...opts,
    })
    throw new Error('Expected process.exit to be called')
  } catch (e) {
    return (e as Error).message
  } finally {
    consoleSpy.mockRestore()
    consoleErrSpy.mockRestore()
    exitSpy.mockRestore()
  }
}

beforeEach(() => {
  tmpDir = createTmpDir()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Unit Tests: generateViteConfig ──────────────────────────────────────────

describe('generateViteConfig', () => {
  it('generates App Router config with RSC plugin', () => {
    const config = generateViteConfig(true)
    expect(config).toContain('import text from "@rue-js/text"')
    expect(config).toContain('text()')
  })

  it('generates Pages Router config without RSC', () => {
    const config = generateViteConfig(false)
    expect(config).toContain('import text from "@rue-js/text"')
    expect(config).toContain('text()')
    expect(config).not.toContain('plugin-rsc')
    expect(config).not.toContain('rsc(')
  })

  it('does not include cloudflare plugin', () => {
    expect(generateViteConfig(true)).not.toContain('cloudflare')
    expect(generateViteConfig(false)).not.toContain('cloudflare')
  })

  it('includes defineConfig import', () => {
    expect(generateViteConfig(true)).toContain('defineConfig')
    expect(generateViteConfig(false)).toContain('defineConfig')
  })
})

// ─── Unit Tests: addScripts ──────────────────────────────────────────────────

describe('addScripts', () => {
  it('adds dev:text, build:text, and start:text scripts', () => {
    setupProject(tmpDir, { router: 'app' })

    const added = addScripts(tmpDir, 3001)

    expect(added).toContain('dev:text')
    expect(added).toContain('build:text')
    expect(added).toContain('start:text')

    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBe('text dev --port 3001')
    expect(pkg.scripts['build:text']).toBe('text build')
    expect(pkg.scripts['start:text']).toBe('text start')
  })

  it('uses custom port', () => {
    setupProject(tmpDir, { router: 'app' })

    addScripts(tmpDir, 4000)

    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBe('text dev --port 4000')
  })

  it('does not overwrite existing scripts', () => {
    setupProject(tmpDir, {
      router: 'app',
      extraPkg: { scripts: { 'dev:text': 'custom-command' } },
    })

    const added = addScripts(tmpDir, 3001)

    expect(added).not.toContain('dev:text')
    expect(added).toContain('build:text')
    expect(added).toContain('start:text')

    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBe('custom-command')
  })

  it('creates scripts object if missing', () => {
    writeFile(tmpDir, 'package.json', JSON.stringify({ name: 'test' }))

    const added = addScripts(tmpDir, 3001)

    expect(added).toContain('dev:text')
    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBeDefined()
  })

  it('returns empty array when no package.json', () => {
    const added = addScripts(tmpDir, 3001)
    expect(added).toEqual([])
  })
})

// ─── Unit Tests: getInitDeps / isDepInstalled ────────────────────────────────

describe('getInitDeps', () => {
  it('returns @rue-js/text + vite for App Router', () => {
    const deps = getInitDeps(true)
    expect(deps).toContain('@rue-js/text')
    expect(deps).toContain('vite')
    expect(deps).not.toContain('@vitejs/plugin-rsc')
  })

  it('returns @rue-js/text + vite for Pages Router', () => {
    const deps = getInitDeps(false)
    expect(deps).toContain('@rue-js/text')
    expect(deps).toContain('vite')
    expect(deps).not.toContain('@vitejs/plugin-rsc')
    expect(deps).not.toContain('rue-rsc-payload')
  })
})

describe('@rue-js/rsc payload protections', () => {
  it('uses the Rue-owned payload codec instead of a vendored Flight decoder', () => {
    const source = readRueRscPayloadSource()

    expect(source).toContain("RUE_RSC_PAYLOAD_PROTOCOL = 'rue-rsc-payload'")
    expect(source).not.toMatch(/function\s+(createMap|createSet|extractIterator)\b/)
    expect(source).not.toMatch(/\$[QWi]\d/)
  })

  it('treats Flight container references as inert payload strings', async () => {
    const decoded = await decodeRuePayloadReadableStream<Record<string, string>>(
      renderRuePayloadToReadableStream({
        map: '$Q1',
        set: '$W2',
        iterator: '$i3',
      }),
    )

    expect(decoded).toEqual({
      map: '$Q1',
      set: '$W2',
      iterator: '$i3',
    })
  })
})

describe('isDepInstalled', () => {
  it('returns true when dep is in dependencies', () => {
    setupProject(tmpDir, { router: 'app' })
    expect(isDepInstalled(tmpDir, '@rue-js/text')).toBe(true)
  })

  it('returns true when dep is in devDependencies', () => {
    setupProject(tmpDir, {
      router: 'app',
      extraPkg: { devDependencies: { vite: '^7.0.0' } },
    })
    expect(isDepInstalled(tmpDir, 'vite')).toBe(true)
  })

  it('returns false when dep is not installed', () => {
    setupProject(tmpDir, { router: 'app' })
    expect(isDepInstalled(tmpDir, 'vite')).toBe(false)
  })

  it('returns false when no package.json', () => {
    expect(isDepInstalled(tmpDir, 'vite')).toBe(false)
  })
})

// ─── Integration: init() ─────────────────────────────────────────────────────

describe('init — basic functionality', () => {
  it('generates vite.config.ts for App Router project', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.generatedViteConfig).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'vite.config.ts'))).toBe(true)

    const config = readFile(tmpDir, 'vite.config.ts')
    expect(config).toContain('import text from "@rue-js/text"')
  })

  it('generates vite.config.ts for Pages Router project', async () => {
    setupProject(tmpDir, { router: 'pages' })

    const { result } = await runInit(tmpDir)

    expect(result.generatedViteConfig).toBe(true)
    const config = readFile(tmpDir, 'vite.config.ts')
    expect(config).toContain('text()')
    expect(config).not.toContain('plugin-rsc')
  })

  it("adds 'type': 'module' to package.json", async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.addedTypeModule).toBe(true)
    const pkg = readPkg(tmpDir)
    expect(pkg.type).toBe('module')
  })

  it("skips adding 'type': 'module' when already present", async () => {
    setupProject(tmpDir, { router: 'app', typeModule: true })

    const { result } = await runInit(tmpDir)

    expect(result.addedTypeModule).toBe(false)
  })

  it('adds dev:text, build:text, and start:text scripts', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.addedScripts).toContain('dev:text')
    expect(result.addedScripts).toContain('build:text')
    expect(result.addedScripts).toContain('start:text')

    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBe('text dev --port 3001')
    expect(pkg.scripts['build:text']).toBe('text build')
    expect(pkg.scripts['start:text']).toBe('text start')
  })

  it('uses custom port in dev:text script', async () => {
    setupProject(tmpDir, { router: 'app' })

    await runInit(tmpDir, { port: 4000 })

    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBe('text dev --port 4000')
  })

  it('does not overwrite existing scripts', async () => {
    setupProject(tmpDir, {
      router: 'app',
      extraPkg: { scripts: { 'dev:text': 'custom-command' } },
    })

    const { result } = await runInit(tmpDir)

    expect(result.addedScripts).not.toContain('dev:text')
    expect(result.addedScripts).toContain('build:text')

    const pkg = readPkg(tmpDir) as { scripts: Record<string, string> }
    expect(pkg.scripts['dev:text']).toBe('custom-command')
  })
})

// ─── CJS Config Renaming ────────────────────────────────────────────────────

describe('init — CJS config renaming', () => {
  it('renames CJS postcss.config.js to .cjs', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, 'postcss.config.js', 'module.exports = { plugins: {} };')

    const { result } = await runInit(tmpDir)

    expect(result.renamedConfigs).toContainEqual(['postcss.config.js', 'postcss.config.cjs'])
    expect(fs.existsSync(path.join(tmpDir, 'postcss.config.cjs'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'postcss.config.js'))).toBe(false)
  })

  it('does not rename ESM config files', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, 'postcss.config.js', 'export default { plugins: {} };')

    const { result } = await runInit(tmpDir)

    expect(result.renamedConfigs).toEqual([])
    expect(fs.existsSync(path.join(tmpDir, 'postcss.config.js'))).toBe(true)
  })
})

// ─── Dependency Installation ─────────────────────────────────────────────────

describe('init — dependency installation', () => {
  it('detects missing vite dependency without reinstalling @rue-js/text', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.installedDeps).not.toContain('@rue-js/text')
    expect(result.installedDeps).toContain('vite')
  })

  it('does not install @vitejs/plugin-rsc for App Router', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.installedDeps).not.toContain('@vitejs/plugin-rsc')
  })

  it('treats src/app projects as App Router', async () => {
    setupProject(tmpDir)
    fs.rmSync(path.join(tmpDir, 'app'), { recursive: true, force: true })

    mkdir(tmpDir, 'src/app')
    writeFile(tmpDir, 'src/app/page.tsx', 'export default function Home() { return <div>hi</div> }')
    writeFile(
      tmpDir,
      'src/app/layout.tsx',
      'export default function Layout({ children }) { return <html><body>{children}</body></html> }',
    )

    const { result } = await runInit(tmpDir)

    expect(result.installedDeps).not.toContain('@vitejs/plugin-rsc')
  })

  it('does not install rue-rsc-payload for App Router', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.installedDeps).not.toContain('rue-rsc-payload')
  })

  it('does not require @vitejs/plugin-rsc for Pages Router', async () => {
    setupProject(tmpDir, { router: 'pages' })

    const { result } = await runInit(tmpDir)

    expect(result.installedDeps).not.toContain('@vitejs/plugin-rsc')
  })

  it('does not require rue-rsc-payload for Pages Router', async () => {
    setupProject(tmpDir, { router: 'pages' })

    const { result } = await runInit(tmpDir)

    expect(result.installedDeps).not.toContain('rue-rsc-payload')
  })

  it('does not upgrade Rue during init', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { execCalls } = await runInit(tmpDir)

    const rueUpgradeCall = execCalls.find(c => c.cmd.includes('rue@latest'))
    expect(rueUpgradeCall).toBeUndefined()
  })

  function withUserAgent<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
    const previous = process.env.npm_config_user_agent
    if (value === undefined) {
      delete process.env.npm_config_user_agent
    } else {
      process.env.npm_config_user_agent = value
    }

    return run().finally(() => {
      if (previous === undefined) {
        delete process.env.npm_config_user_agent
      } else {
        process.env.npm_config_user_agent = previous
      }
    })
  }

  it('calls exec with correct package manager for pnpm', async () => {
    setupProject(tmpDir, { router: 'pages' })
    writeFile(tmpDir, 'pnpm-lock.yaml', 'lockfileVersion: 5')

    const { execCalls } = await runInit(tmpDir)

    const installCall = execCalls.find(
      c => c.cmd.includes('add -D') || c.cmd.includes('install -D'),
    )
    expect(installCall).toBeDefined()
    expect(installCall!.cmd).toMatch(/^pnpm add -D/)
  })

  it('calls exec with bun when bun.lock exists', async () => {
    setupProject(tmpDir, { router: 'pages' })
    writeFile(tmpDir, 'bun.lock', '# bun lockfile')

    const { execCalls } = await runInit(tmpDir)

    const installCall = execCalls.find(
      c => c.cmd.includes('add -D') || c.cmd.includes('install -D'),
    )
    expect(installCall).toBeDefined()
    expect(installCall!.cmd).toMatch(/^bun add -D/)
  })

  it('uses package.json#packageManager when lock files are missing', async () => {
    setupProject(tmpDir, {
      router: 'pages',
      extraPkg: { packageManager: 'bun@1.2.3' },
    })

    const { execCalls } = await runInit(tmpDir)

    const installCall = execCalls.find(
      c => c.cmd.includes('add -D') || c.cmd.includes('install -D'),
    )
    expect(installCall).toBeDefined()
    expect(installCall!.cmd).toMatch(/^bun add -D/)
  })

  it('uses invoking package manager from npm_config_user_agent when project has no PM hints', async () => {
    setupProject(tmpDir, { router: 'pages' })

    const { execCalls } = await withUserAgent('bun/1.2.3 npm/? node/v22.0.0', () => runInit(tmpDir))

    const installCall = execCalls.find(
      c => c.cmd.includes('add -D') || c.cmd.includes('install -D'),
    )
    expect(installCall).toBeDefined()
    expect(installCall!.cmd).toMatch(/^bun add -D/)
  })

  it('falls back to npm when no lock file, no packageManager, and no user-agent hint', async () => {
    setupProject(tmpDir, { router: 'pages' })

    const { execCalls } = await withUserAgent(undefined, () => runInit(tmpDir))

    const installCall = execCalls.find(
      c => c.cmd.includes('install -D') || c.cmd.includes('add -D'),
    )
    expect(installCall).toBeDefined()
    expect(installCall!.cmd).toMatch(/^npm install -D/)
  })
})

// ─── Guard Rails ─────────────────────────────────────────────────────────────

describe('init — guard rails', () => {
  it('skips vite.config.ts when it already exists (without --force)', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, 'vite.config.ts', 'export default {}')

    const { result } = await runInit(tmpDir)

    expect(result.generatedViteConfig).toBe(false)
    expect(result.skippedViteConfig).toBe(true)
    // Original config should be preserved
    const config = readFile(tmpDir, 'vite.config.ts')
    expect(config).toBe('export default {}')
  })

  it('still runs all other steps when vite.config.ts exists', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, 'vite.config.ts', 'export default {}')

    const { result } = await runInit(tmpDir)

    // Dependencies should still be installed
    expect(result.installedDeps).toContain('vite')
    // ESM migration should still happen
    expect(result.addedTypeModule).toBe(true)
    // Scripts should still be added
    expect(result.addedScripts).toContain('dev:text')
    expect(result.addedScripts).toContain('build:text')
    expect(result.addedScripts).toContain('start:text')
    // But vite config should be skipped
    expect(result.generatedViteConfig).toBe(false)
    expect(result.skippedViteConfig).toBe(true)
  })

  it('overwrites vite.config.ts with --force', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, 'vite.config.ts', 'export default {}')

    const { result } = await runInit(tmpDir, { force: true })

    expect(result.generatedViteConfig).toBe(true)
    expect(result.skippedViteConfig).toBe(false)
    const config = readFile(tmpDir, 'vite.config.ts')
    expect(config).toContain('text()')
  })

  it('exits when no package.json exists', async () => {
    mkdir(tmpDir, 'app')

    const msg = await runInitExpectExit(tmpDir)
    expect(msg).toContain('process.exit(1)')
  })
})

// ─── Preserves Existing Project ─────────��────────────────────────────────────

describe('init — non-destructive', () => {
  it('preserves existing package.json fields', async () => {
    setupProject(tmpDir, {
      router: 'app',
      extraPkg: {
        scripts: { dev: 'legacy-dev', build: 'legacy-build' },
        dependencies: { rue: '^19.0.0', text: '^15.0.0' },
      },
    })

    await runInit(tmpDir)

    const pkg = readPkg(tmpDir) as Record<string, Record<string, string>>
    expect(pkg.scripts.dev).toBe('legacy-dev')
    expect(pkg.scripts.build).toBe('legacy-build')
    expect(pkg.dependencies.rue).toBe('^19.0.0')
    expect(pkg.dependencies.text).toBe('^15.0.0')
  })

  it('does not modify source files', async () => {
    setupProject(tmpDir, { router: 'app' })
    const originalPage = readFile(tmpDir, 'app/page.tsx')

    await runInit(tmpDir)

    expect(readFile(tmpDir, 'app/page.tsx')).toBe(originalPage)
  })

  it('does not modify text.config', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, 'text.config.mjs', 'export default {};')
    const originalConfig = readFile(tmpDir, 'text.config.mjs')

    await runInit(tmpDir)

    expect(readFile(tmpDir, 'text.config.mjs')).toBe(originalConfig)
  })
})

// ─── Unit Tests: updateGitignore ─────────────────────────────────────────────

describe('updateGitignore', () => {
  it('creates .gitignore with /dist/ when file does not exist', () => {
    const result = updateGitignore(tmpDir)

    expect(result).toBe(true)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toBe('/dist/\n')
  })

  it('appends /dist/ to existing .gitignore', () => {
    writeFile(tmpDir, '.gitignore', 'node_modules/\n.env\n')

    const result = updateGitignore(tmpDir)

    expect(result).toBe(true)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toBe('node_modules/\n.env\n/dist/\n')
  })

  it('does not duplicate /dist/ when already present', () => {
    writeFile(tmpDir, '.gitignore', 'node_modules/\n/dist/\n')

    const result = updateGitignore(tmpDir)

    expect(result).toBe(false)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toBe('node_modules/\n/dist/\n')
  })

  it('handles .gitignore without trailing newline', () => {
    writeFile(tmpDir, '.gitignore', 'node_modules/')

    const result = updateGitignore(tmpDir)

    expect(result).toBe(true)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toBe('node_modules/\n/dist/\n')
  })

  it('handles /dist/ with surrounding whitespace in existing file', () => {
    writeFile(tmpDir, '.gitignore', 'node_modules/\n  /dist/  \n')

    const result = updateGitignore(tmpDir)

    expect(result).toBe(false)
  })

  it('does not add /dist/ when dist/ (without leading slash) is already present', () => {
    writeFile(tmpDir, '.gitignore', 'node_modules/\ndist/\n')

    const result = updateGitignore(tmpDir)

    expect(result).toBe(false)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toBe('node_modules/\ndist/\n')
  })

  it('does not add /dist/ when bare dist is already present', () => {
    writeFile(tmpDir, '.gitignore', 'node_modules/\ndist\n')

    const result = updateGitignore(tmpDir)

    expect(result).toBe(false)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toBe('node_modules/\ndist\n')
  })
})

// ─── Integration: init updates .gitignore ────────────────────────────────────

describe('init — .gitignore', () => {
  it('adds /dist/ to .gitignore during init', async () => {
    setupProject(tmpDir, { router: 'app' })

    const { result } = await runInit(tmpDir)

    expect(result.updatedGitignore).toBe(true)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toContain('/dist/')
  })

  it('does not duplicate /dist/ if already in .gitignore', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, '.gitignore', 'node_modules/\n/dist/\n')

    const { result } = await runInit(tmpDir)

    expect(result.updatedGitignore).toBe(false)
    // Ensure no duplication
    const content = readFile(tmpDir, '.gitignore')
    const matches = content.split('\n').filter((l: string) => l.trim() === '/dist/')
    expect(matches.length).toBe(1)
  })

  it('preserves existing .gitignore entries when adding /dist/', async () => {
    setupProject(tmpDir, { router: 'app' })
    writeFile(tmpDir, '.gitignore', 'node_modules/\n.env\n.text/\n')

    const { result } = await runInit(tmpDir)

    expect(result.updatedGitignore).toBe(true)
    const content = readFile(tmpDir, '.gitignore')
    expect(content).toContain('node_modules/')
    expect(content).toContain('.env')
    expect(content).toContain('.text/')
    expect(content).toContain('/dist/')
  })
})
