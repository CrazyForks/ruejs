// @vitest-environment jsdom

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const runtimeVaporDir = path.resolve(projectRoot, 'packages/runtime-vapor')
const generatorPath = path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs')
const legacyCommentsCheckerPath = path.resolve(
  runtimeVaporDir,
  'scripts/check-legacy-rust-comments.mjs',
)
const legacyCommentsCatalogPath = path.resolve(runtimeVaporDir, 'legacy-rust-comments.json')

const rootTargets = [
  'index.js',
  'index.node.js',
  'reactive.js',
  'reactive.node.js',
  'reactive.vapor.js',
  'runtime-entry-wrap.js',
  'vapor-bridge.js',
  'vapor.js',
  'vapor.node.js',
]

const reactiveTargets = [
  'js-reactive/facade.js',
  'js-reactive/hooks/computed.js',
  'js-reactive/hooks/context.js',
  'js-reactive/hooks/effect.js',
  'js-reactive/hooks/index.js',
  'js-reactive/hooks/state.js',
  'js-reactive/hooks/values.js',
]

const runtimeTargets = [
  'js-runtime/app.js',
  'js-runtime/component.js',
  'js-runtime/create-rue.js',
  'js-runtime/errors.js',
  'js-runtime/host.js',
  'js-runtime/instance.js',
  'js-runtime/keep-alive.js',
  'js-runtime/kernel-bridge.js',
  'js-runtime/lifecycle.js',
  'js-runtime/mount-input.js',
  'js-runtime/mount.js',
  'js-runtime/owned-mount.js',
  'js-runtime/patch/component.js',
  'js-runtime/patch/replace.js',
  'js-runtime/patch/text.js',
  'js-runtime/plugins.js',
  'js-runtime/props.js',
  'js-runtime/render/anchor.js',
  'js-runtime/render/container.js',
  'js-runtime/render/helpers.js',
  'js-runtime/render/range.js',
  'js-runtime/render/static.js',
  'js-runtime/state.js',
  'js-runtime/types.js',
]

const expectedTargets = [...rootTargets, ...reactiveTargets, ...runtimeTargets].sort()
const fixtureDirs: string[] = []

interface RuntimeTypeScriptTool {
  RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS: readonly string[]
  RUNTIME_TYPESCRIPT_TARGETS: readonly string[]
  auditTypeScriptRuntime(options: {
    runtimeDir: string
    targets?: readonly string[]
    explicitAnyAllowlist?: readonly string[]
  }): Promise<{
    targetCount: number
    migratedCount: number
    violations: Array<{ rule: string; source: string; line: number }>
  }>
  emitTypeScriptRuntime(options: {
    runtimeDir: string
    targets?: readonly string[]
    explicitAnyAllowlist?: readonly string[]
  }): Promise<{ outputFiles: string[] }>
}

interface LegacyRustCommentsTool {
  auditLegacyRustComments(options: { projectRoot: string; catalogPath: string }): Promise<{
    sourceCommit: string
    scannedFileCount: number
    commentedFileCount: number
    sourceChineseLineCount: number
    sourceBlockCount: number
    catalogBlockCount: number
    sourceHash: string
    catalogHash: string
    missingBlocks: string[]
    extraBlocks: string[]
    missingTargets: string[]
    invalidEntries: string[]
  }>
}

const loadTool = async (): Promise<RuntimeTypeScriptTool> =>
  (await import(`${pathToFileURL(generatorPath).href}?test=${Date.now()}`)) as RuntimeTypeScriptTool

const loadLegacyCommentsTool = async (): Promise<LegacyRustCommentsTool> =>
  (await import(
    `${pathToFileURL(legacyCommentsCheckerPath).href}?test=${Date.now()}`
  )) as LegacyRustCommentsTool

const writeFixture = async (root: string, relativePath: string, contents: string) => {
  const filePath = path.resolve(root, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

const hashFiles = async (root: string, files: readonly string[]) => {
  const hash = createHash('sha256')
  for (const file of [...files].sort()) {
    hash.update(file)
    hash.update(await readFile(path.resolve(root, file)))
  }
  return hash.digest('hex')
}

afterEach(async () => {
  await Promise.all(fixtureDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('runtime-vapor TypeScript build guardrails', () => {
  it('keeps the legacy Rust Chinese comment catalog aligned with the baseline Git object', async () => {
    const tool = await loadLegacyCommentsTool()
    const audit = await tool.auditLegacyRustComments({
      projectRoot,
      catalogPath: legacyCommentsCatalogPath,
    })

    expect(audit).toMatchObject({
      sourceCommit: '41552d14bcc6d992eee25dc40e0887e1cc5213e6',
      scannedFileCount: 82,
      commentedFileCount: 81,
      sourceChineseLineCount: 1317,
      sourceBlockCount: 578,
      catalogBlockCount: 578,
      missingBlocks: [],
      extraBlocks: [],
      missingTargets: [],
      invalidEntries: [],
    })
    expect(audit.sourceBlockCount).toBe(audit.catalogBlockCount)
    expect(audit.sourceHash).toBe(audit.catalogHash)
    console.info(
      `[runtime-vapor legacy comments] ${audit.sourceBlockCount} blocks / ${audit.sourceChineseLineCount} Chinese lines / ${audit.sourceHash}`,
    )
  })

  it('identifies the exact legacy comment entries missing a source, target, or body', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-legacy-comments-'))
    fixtureDirs.push(fixtureDir)
    const malformedCatalog = JSON.parse(await readFile(legacyCommentsCatalogPath, 'utf8')) as {
      sourceFiles: Array<{
        sourcePath: string
        blocks: Array<{ id: string; target?: string; text?: string }>
      }>
    }
    const removedSource = malformedCatalog.sourceFiles.shift()!
    const targetlessBlock = malformedCatalog.sourceFiles[0]!.blocks[0]!
    const bodylessBlock = malformedCatalog.sourceFiles[1]!.blocks[0]!
    delete targetlessBlock.target
    bodylessBlock.text = ''
    const malformedCatalogPath = path.resolve(fixtureDir, 'legacy-rust-comments.json')
    await writeFile(malformedCatalogPath, `${JSON.stringify(malformedCatalog)}\n`, 'utf8')

    const tool = await loadLegacyCommentsTool()
    const audit = await tool.auditLegacyRustComments({
      projectRoot,
      catalogPath: malformedCatalogPath,
    })

    expect(audit.invalidEntries).toContain(`${removedSource.sourcePath}: missing source entry`)
    expect(audit.missingBlocks).toEqual(
      expect.arrayContaining(removedSource.blocks.map(block => block.id)),
    )
    expect(audit.missingTargets).toContain(targetlessBlock.id)
    expect(audit.invalidEntries).toContain(`${bodylessBlock.id}: missing text`)
  })

  it('defines the exact 40 handwritten runtime targets', async () => {
    const tool = await loadTool()

    expect(expectedTargets).toHaveLength(40)
    expect([...tool.RUNTIME_TYPESCRIPT_TARGETS].sort()).toEqual(expectedTargets)
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS).not.toContain('vitest-shim.cjs')
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS.some(file => file.startsWith('pkg-'))).toBe(false)
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS.some(file => file.startsWith('scripts/'))).toBe(false)

    const audit = await tool.auditTypeScriptRuntime({ runtimeDir: runtimeVaporDir })
    expect(audit).toMatchObject({ targetCount: 40, migratedCount: 40, violations: [] })
    console.info(
      `[runtime-vapor TypeScript] ${audit.migratedCount}/${audit.targetCount} migrated targets`,
    )
  })

  it('closes JavaScript compatibility after all handwritten runtime sources migrate', async () => {
    const tsconfig = JSON.parse(
      await readFile(path.resolve(runtimeVaporDir, 'tsconfig.json'), 'utf8'),
    ) as { compilerOptions: Record<string, unknown>; include: string[]; exclude: string[] }
    const packageJson = JSON.parse(
      await readFile(path.resolve(runtimeVaporDir, 'package.json'), 'utf8'),
    ) as { files: string[]; scripts: Record<string, string> }

    expect(tsconfig.compilerOptions).toMatchObject({
      allowJs: false,
      checkJs: false,
      strict: true,
      noImplicitAny: true,
      noUncheckedIndexedAccess: true,
      useUnknownInCatchVariables: true,
      noEmit: true,
    })
    expect(tsconfig.include).toEqual(
      expect.arrayContaining([
        './*.ts',
        './js-reactive/**/*.ts',
        './js-runtime/**/*.ts',
        './runtime-vapor-env.d.ts',
      ]),
    )
    expect(tsconfig.include.some(pattern => pattern.endsWith('.js'))).toBe(false)
    expect(tsconfig.exclude).toEqual(
      expect.arrayContaining(['./pkg-*', './scripts', './src', './tests']),
    )
    expect(packageJson.scripts['check-ts']).toContain('tsc -p tsconfig.json --noEmit')
    expect(packageJson.scripts['check-ts']).toContain('emit-typescript-runtime.mjs --check')
    expect(packageJson.scripts['build-ts']).toBe('node ./scripts/emit-typescript-runtime.mjs')

    expect(packageJson.scripts.build).toMatch(/^npm run build-ts && /)
    expect(packageJson.scripts['build-vapor']).toMatch(/^npm run build-ts && /)
    expect(packageJson.scripts['build-node']).toMatch(/^npm run build-ts && /)
    expect(packageJson.scripts.prepack).toBe(
      'npm run check-ts && npm run build && npm run build-node',
    )
    expect(packageJson.scripts.prepublishOnly).toBe(
      'npm run check-ts && npm run build && npm run build-node',
    )
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        'global.d.ts',
        'js-reactive/**/*.js',
        'js-reactive/**/*.d.ts',
        'js-runtime/**/*.js',
        'js-runtime/**/*.d.ts',
      ]),
    )
    expect(packageJson.files).not.toContain('js-reactive')
    expect(packageJson.files).not.toContain('js-runtime')
  })

  it('emits the type-only declaration dependency used by public entry declarations', async () => {
    const tool = await loadTool()
    expect(tool.RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS).toEqual(['js-reactive/types.d.ts'])
    expect(
      await readFile(path.resolve(runtimeVaporDir, 'js-reactive/types.d.ts'), 'utf8'),
    ).toContain('export type ObjectLike')
  })

  it('keeps every generated JavaScript target out of the tracked handwritten source set', () => {
    const trackedJavaScript = execFileSync(
      'git',
      [
        'ls-files',
        'packages/runtime-vapor/*.js',
        'packages/runtime-vapor/js-*/*.js',
        'packages/runtime-vapor/js-*/*/*.js',
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    )

    expect(trackedJavaScript.trim()).toBe('')
  })

  it('runs TypeScript generation before Wasm consumers in ensure, app-dev, and release flows', async () => {
    const [ensureBuild, preAppDev, release] = await Promise.all(
      ['scripts/ensure-runtime-vapor-build.js', 'scripts/pre-app-dev.js', 'scripts/release.js'].map(
        file => readFile(path.resolve(projectRoot, file), 'utf8'),
      ),
    )

    expect(ensureBuild).toContain("run', 'build-ts'")
    expect(preAppDev).toContain("script: 'build-ts'")
    expect(release).toContain("run', 'check-ts'")
    expect(release).toContain("run', 'build-ts'")
  })

  it('uses exact generated-JavaScript ignore rules instead of directory-wide ignores', async () => {
    const gitignore = (await readFile(path.resolve(projectRoot, '.gitignore'), 'utf8')).split(
      /\r?\n/,
    )
    const exactRules = new Set(
      gitignore.filter(line => line.startsWith('/packages/runtime-vapor/')),
    )

    for (const target of expectedTargets) {
      expect(exactRules).toContain(`/packages/runtime-vapor/${target}`)
    }
    expect(gitignore).not.toContain('/packages/runtime-vapor/*.js')
    expect(gitignore).not.toContain('/packages/runtime-vapor/js-runtime/')
    expect(gitignore).not.toContain('/packages/runtime-vapor/js-reactive/')
  })

  it('emits deterministic ESM JavaScript and declarations only for registered TS sources', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-ts-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(fixtureDir, 'js-runtime/app.ts', `export { answer } from './types.js'\n`)
    await writeFixture(fixtureDir, 'js-runtime/types.ts', `export const answer: number = 42\n`)
    await writeFixture(fixtureDir, 'js-runtime/unregistered.ts', `export const ignored = true\n`)

    const tool = await loadTool()
    const targets = ['js-runtime/app.js', 'js-runtime/types.js']
    const first = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })
    const firstHash = await hashFiles(fixtureDir, first.outputFiles)
    const second = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })
    const secondHash = await hashFiles(fixtureDir, second.outputFiles)

    expect(first.outputFiles).toEqual([
      'js-runtime/app.d.ts',
      'js-runtime/app.js',
      'js-runtime/types.d.ts',
      'js-runtime/types.js',
    ])
    expect(await readFile(path.resolve(fixtureDir, 'js-runtime/app.js'), 'utf8')).toContain(
      `from './types.js'`,
    )
    expect(await readFile(path.resolve(fixtureDir, 'js-runtime/app.d.ts'), 'utf8')).toContain(
      `from './types.js'`,
    )
    await expect(
      readFile(path.resolve(fixtureDir, 'js-runtime/unregistered.js'), 'utf8'),
    ).rejects.toThrow()
    expect(second.outputFiles).toEqual(first.outputFiles)
    expect(secondHash).toBe(firstHash)
    console.info(`[runtime-vapor TypeScript] fixture sha256 ${firstHash}`)
  })

  it('rebuilds clean entry JavaScript and public declarations from TypeScript alone', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-entry-ts-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(
      fixtureDir,
      'reactive.ts',
      `export interface Signal<T> { get(): T }\nexport const signal = <T>(value: T): Signal<T> => ({ get: () => value })\n`,
    )
    await writeFixture(
      fixtureDir,
      'index.ts',
      `export type { Signal } from './reactive.js'\nexport { signal } from './reactive.js'\n`,
    )
    await writeFixture(
      fixtureDir,
      'vapor.ts',
      `export * from './reactive.js'\nexport const createRue = (adapter: unknown) => ({ adapter })\n`,
    )

    const tool = await loadTool()
    const targets = ['index.js', 'reactive.js', 'vapor.js']
    const first = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })
    const firstHash = await hashFiles(fixtureDir, first.outputFiles)
    await Promise.all(first.outputFiles.map(file => rm(path.resolve(fixtureDir, file))))
    const second = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })

    expect(second.outputFiles).toEqual([
      'index.d.ts',
      'index.js',
      'reactive.d.ts',
      'reactive.js',
      'vapor.d.ts',
      'vapor.js',
    ])
    expect(await hashFiles(fixtureDir, second.outputFiles)).toBe(firstHash)
    expect(await readFile(path.resolve(fixtureDir, 'index.d.ts'), 'utf8')).toContain(
      `export type { Signal } from './reactive.js'`,
    )
    expect(await readFile(path.resolve(fixtureDir, 'vapor.d.ts'), 'utf8')).toContain(
      `export * from './reactive.js'`,
    )
  })

  it.each([
    ['@ts-ignore', `// @ts-ignore\nexport const value: string = 1\n`],
    ['@ts-nocheck', `// @ts-nocheck\nexport const value = 1\n`],
    ['explicit-any', `export const identity = (value: any) => value\n`],
  ])('rejects unapproved %s in migrated sources', async (rule, source) => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-audit-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(fixtureDir, 'js-runtime/app.ts', source)

    const tool = await loadTool()
    const audit = await tool.auditTypeScriptRuntime({
      runtimeDir: fixtureDir,
      targets: ['js-runtime/app.js'],
    })

    expect(audit.violations.map(violation => violation.rule)).toContain(rule)
    await expect(
      tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets: ['js-runtime/app.js'] }),
    ).rejects.toThrow(rule)
  })

  it('accepts an explicit any only when its source line is registered', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-any-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(
      fixtureDir,
      'js-runtime/app.ts',
      `export const identity = (value: any) => value\n`,
    )

    const tool = await loadTool()
    const audit = await tool.auditTypeScriptRuntime({
      runtimeDir: fixtureDir,
      targets: ['js-runtime/app.js'],
      explicitAnyAllowlist: ['js-runtime/app.ts:1'],
    })

    expect(audit.violations).toEqual([])
    await expect(
      tool.emitTypeScriptRuntime({
        runtimeDir: fixtureDir,
        targets: ['js-runtime/app.js'],
        explicitAnyAllowlist: ['js-runtime/app.ts:1'],
      }),
    ).resolves.toMatchObject({
      outputFiles: ['js-runtime/app.d.ts', 'js-runtime/app.js'],
    })
  })
})
