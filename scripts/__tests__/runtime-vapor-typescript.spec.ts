// @vitest-environment jsdom

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const runtimeVaporDir = path.resolve(projectRoot, 'packages/runtime-vapor')
const runtimeVaporSourceDir = path.resolve(runtimeVaporDir, 'src')
const runtimeVaporDistDir = path.resolve(runtimeVaporDir, 'dist')
const generatorPath = path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs')

const rootTargets = [
  'compiled.js',
  'index.js',
  'index.node.js',
  'protocol.js',
  'reactive.browser.js',
  'reactive.js',
  'reactive.node.js',
  'reactive.shared.js',
  'reactive.vapor.js',
  'runtime-entry.js',
  'runtime-entry-wrap.js',
  'vapor-bridge.js',
  'vapor.js',
  'vapor.node.js',
]

const kernelTargets = [
  'reactive-kernel/computed.js',
  'reactive-kernel/effect.js',
  'reactive-kernel/graph.js',
  'reactive-kernel/index.js',
  'reactive-kernel/log.js',
  'reactive-kernel/reactive.js',
  'reactive-kernel/resource.js',
  'reactive-kernel/runtime-state.js',
  'reactive-kernel/scheduler.js',
  'reactive-kernel/scope.js',
  'reactive-kernel/signal.js',
  'reactive-kernel/watch.js',
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

const expectedTargets = [
  ...rootTargets,
  ...reactiveTargets,
  ...runtimeTargets,
  ...kernelTargets,
].sort()
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

const loadTool = async (): Promise<RuntimeTypeScriptTool> =>
  (await import(`${pathToFileURL(generatorPath).href}?test=${Date.now()}`)) as RuntimeTypeScriptTool

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
  it('defines the exact 57 handwritten runtime targets', async () => {
    const tool = await loadTool()

    expect(expectedTargets).toHaveLength(57)
    expect([...tool.RUNTIME_TYPESCRIPT_TARGETS].sort()).toEqual(expectedTargets)
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS).not.toContain('vitest-shim.cjs')
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS.some(file => file.startsWith('pkg-'))).toBe(false)
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS.some(file => file.startsWith('scripts/'))).toBe(false)
    expect(tool.targetsForPlatform('node')).toEqual(
      expectedTargets.filter(
        target =>
          ![
            'compiled.js',
            'index.js',
            'reactive.browser.js',
            'reactive.js',
            'reactive.vapor.js',
            'vapor.js',
          ].includes(target),
      ),
    )
    expect(tool.targetsForPlatform('browser')).toEqual(
      expectedTargets.filter(
        target => !['index.node.js', 'reactive.node.js', 'vapor.node.js'].includes(target),
      ),
    )

    const audit = await tool.auditTypeScriptRuntime({ runtimeDir: runtimeVaporDir })
    expect(audit).toMatchObject({ targetCount: 57, migratedCount: 57, violations: [] })
    console.info(
      `[runtime-vapor TypeScript] ${audit.migratedCount}/${audit.targetCount} migrated targets`,
    )
  })

  it('uses Node-loadable ESM specifiers inside the generated kernel graph', async () => {
    for (const target of kernelTargets) {
      const source = await readFile(
        path.resolve(runtimeVaporSourceDir, target.replace(/\.js$/, '.ts')),
        'utf8',
      )
      const relativeSpecifiers = [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map(
        match => match[1],
      )
      for (const specifier of relativeSpecifiers) {
        expect(specifier, target).toMatch(/\.js$/)
      }
    }
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
    expect(tsconfig.include).toEqual(expect.arrayContaining(['./src/**/*.ts', './src/global.d.ts']))
    expect(tsconfig.include.some(pattern => pattern.endsWith('.js'))).toBe(false)
    expect(tsconfig.exclude).toEqual(
      expect.arrayContaining(['./dist', './pkg-*', './scripts', './tests']),
    )
    expect(packageJson.scripts['check-ts']).toContain('tsc -p tsconfig.json --noEmit')
    expect(packageJson.scripts['check-ts']).toContain('emit-typescript-runtime.mjs --check')
    expect(packageJson.scripts['build-ts']).toBe('node ./scripts/emit-typescript-runtime.mjs')

    expect(packageJson.scripts.build).toBe('npm run build-ts')
    expect(packageJson.scripts['build-vapor']).toBe('npm run build-ts -- --platform browser')
    expect(packageJson.scripts['build-node']).toBe('npm run build-ts -- --platform node')
    expect(packageJson.scripts.prepack).toBe('npm run check-ts && npm run build')
    expect(packageJson.scripts.prepublishOnly).toBe('npm run check-ts && npm run build')
    expect(packageJson.files).toEqual(['dist'])
  })

  it('tracks only the handwritten ambient declaration and resolves public paths to TypeScript', async () => {
    const rootTsconfig = JSON.parse(
      await readFile(path.resolve(projectRoot, 'tsconfig.json'), 'utf8'),
    ) as {
      compilerOptions: { paths: Record<string, string[]> }
      include: string[]
    }
    const runtimeTsconfig = JSON.parse(
      await readFile(path.resolve(runtimeVaporDir, 'tsconfig.json'), 'utf8'),
    ) as { include: string[] }
    const trackedDeclarations = execFileSync(
      'git',
      [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        'packages/runtime-vapor/**/*.d.ts',
        'packages/runtime-vapor/*.d.ts',
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(file => existsSync(path.resolve(projectRoot, file)))
      .sort()

    expect.soft(rootTsconfig.compilerOptions.paths).toMatchObject({
      '@rue-js/runtime-vapor': ['./packages/runtime-vapor/src/index.ts'],
      '@rue-js/runtime-vapor/protocol': ['./packages/runtime-vapor/src/protocol.ts'],
      '@rue-js/runtime-vapor/reactive': ['./packages/runtime-vapor/src/reactive.ts'],
      '@rue-js/runtime-vapor/vapor': ['./packages/runtime-vapor/src/vapor.ts'],
    })
    expect.soft(rootTsconfig.include).toContain('packages/runtime-vapor/src/global.d.ts')
    expect.soft(rootTsconfig.include).not.toContain('packages/runtime-vapor/runtime-vapor-env.d.ts')
    expect.soft(runtimeTsconfig.include).toContain('./src/global.d.ts')
    expect.soft(runtimeTsconfig.include).not.toContain('./runtime-vapor-env.d.ts')
    expect.soft(trackedDeclarations).toEqual(['packages/runtime-vapor/src/global.d.ts'])
  })

  it('emits the type-only declaration dependency used by public entry declarations', async () => {
    const tool = await loadTool()
    const typesDeclaration = await readFile(
      path.resolve(runtimeVaporDistDir, 'js-reactive/types.d.ts'),
      'utf8',
    )
    expect(tool.RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS).toEqual(['js-reactive/types.d.ts'])
    expect(typesDeclaration).toContain('export type ObjectLike')
    expect(typesDeclaration).toContain('/// <reference lib="esnext.disposable" preserve="true" />')
    expect(typesDeclaration).not.toMatch(/pkg-(?:node|vapor)/)
  })

  it('publishes the generated portable protocol entry and declaration', async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(runtimeVaporDir, 'package.json'), 'utf8'),
    ) as {
      exports: Record<string, { types?: string; import?: string; default?: string }>
      files: string[]
    }

    expect(packageJson.exports['./protocol']).toEqual({
      types: './dist/protocol.d.ts',
      import: './dist/protocol.js',
      default: './dist/protocol.js',
    })
    expect(packageJson.files).toEqual(['dist'])

    const tool = await loadTool()
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-protocol-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(
      fixtureDir,
      'src/protocol.ts',
      `export const FIELD = '__fixture'\nexport interface Handle { [FIELD]: number }\n`,
    )
    await expect(
      tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets: ['protocol.js'] }),
    ).resolves.toMatchObject({ outputFiles: ['dist/protocol.d.ts', 'dist/protocol.js'] })
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

  it('builds only TypeScript artifacts in ensure, app-dev, and release flows', async () => {
    const [ensureBuild, preAppDev, release] = await Promise.all(
      ['scripts/ensure-runtime-vapor-build.js', 'scripts/pre-app-dev.js', 'scripts/release.js'].map(
        file => readFile(path.resolve(projectRoot, file), 'utf8'),
      ),
    )

    expect(ensureBuild).toContain("run', 'build-ts'")
    expect(ensureBuild).not.toMatch(/pkg-(?:vapor|node)|wasm-pack|\.wasm/)
    expect(preAppDev).toContain("script: shouldBuildNodeRuntime ? 'build-ts' : 'build-ts:browser'")
    expect(preAppDev).not.toMatch(/pkg-(?:vapor|node)|wasm-pack|\.wasm/)
    expect(release).toContain("run', 'check-ts'")
    expect(release).toContain("run', 'build-ts'")
    expect(release).not.toMatch(/pkg-(?:vapor|node)|wasm-pack|\.wasm/)
  })

  it('ignores the generated dist directory without ignoring handwritten sources', async () => {
    const gitignore = (await readFile(path.resolve(projectRoot, '.gitignore'), 'utf8')).split(
      /\r?\n/,
    )
    expect(gitignore).toContain('/packages/runtime-vapor/dist/')
    expect(gitignore).not.toContain('/packages/runtime-vapor/src/')
  })

  it('emits deterministic ESM JavaScript and declarations only for registered TS sources', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-ts-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(fixtureDir, 'src/js-runtime/app.ts', `export { answer } from './types.js'\n`)
    await writeFixture(fixtureDir, 'src/js-runtime/types.ts', `export const answer: number = 42\n`)
    await writeFixture(
      fixtureDir,
      'src/js-runtime/unregistered.ts',
      `export const ignored = true\n`,
    )

    const tool = await loadTool()
    const targets = ['js-runtime/app.js', 'js-runtime/types.js']
    const first = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })
    const firstHash = await hashFiles(fixtureDir, first.outputFiles)
    const second = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })
    const secondHash = await hashFiles(fixtureDir, second.outputFiles)

    expect(first.outputFiles).toEqual([
      'dist/js-runtime/app.d.ts',
      'dist/js-runtime/app.js',
      'dist/js-runtime/types.d.ts',
      'dist/js-runtime/types.js',
    ])
    expect(await readFile(path.resolve(fixtureDir, 'dist/js-runtime/app.js'), 'utf8')).toContain(
      `from './types.js'`,
    )
    expect(await readFile(path.resolve(fixtureDir, 'dist/js-runtime/app.d.ts'), 'utf8')).toContain(
      `from './types.js'`,
    )
    await expect(
      readFile(path.resolve(fixtureDir, 'dist/js-runtime/unregistered.js'), 'utf8'),
    ).rejects.toThrow()
    expect(second.outputFiles).toEqual(first.outputFiles)
    expect(secondHash).toBe(firstHash)
    console.info(`[runtime-vapor TypeScript] fixture sha256 ${firstHash}`)
  })

  it('uses the handwritten global ambient declaration during TypeScript emit', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-global-types-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(
      fixtureDir,
      'src/global.d.ts',
      `export {}\ndeclare global { const __RUE_RUNTIME_VAPOR_FIXTURE__: number }\n`,
    )
    await writeFixture(
      fixtureDir,
      'src/js-runtime/app.ts',
      `export const answer = __RUE_RUNTIME_VAPOR_FIXTURE__\n`,
    )

    const tool = await loadTool()

    await expect(
      tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets: ['js-runtime/app.js'] }),
    ).resolves.toMatchObject({
      outputFiles: ['dist/global.d.ts', 'dist/js-runtime/app.d.ts', 'dist/js-runtime/app.js'],
    })
  })

  it('rebuilds clean entry JavaScript and public declarations from TypeScript alone', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-entry-ts-'))
    fixtureDirs.push(fixtureDir)
    await writeFixture(
      fixtureDir,
      'src/reactive.ts',
      `export interface Signal<T> { get(): T }\nexport const signal = <T>(value: T): Signal<T> => ({ get: () => value })\n`,
    )
    await writeFixture(
      fixtureDir,
      'src/index.ts',
      `export type { Signal } from './reactive.js'\nexport { signal } from './reactive.js'\n`,
    )
    await writeFixture(
      fixtureDir,
      'src/vapor.ts',
      `export * from './reactive.js'\nexport const createRue = (adapter: unknown) => ({ adapter })\n`,
    )

    const tool = await loadTool()
    const targets = ['index.js', 'reactive.js', 'vapor.js']
    const first = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })
    const firstHash = await hashFiles(fixtureDir, first.outputFiles)
    await Promise.all(first.outputFiles.map(file => rm(path.resolve(fixtureDir, file))))
    const second = await tool.emitTypeScriptRuntime({ runtimeDir: fixtureDir, targets })

    expect(second.outputFiles).toEqual([
      'dist/index.d.ts',
      'dist/index.js',
      'dist/reactive.d.ts',
      'dist/reactive.js',
      'dist/vapor.d.ts',
      'dist/vapor.js',
    ])
    expect(await hashFiles(fixtureDir, second.outputFiles)).toBe(firstHash)
    expect(await readFile(path.resolve(fixtureDir, 'dist/index.d.ts'), 'utf8')).toContain(
      `export type { Signal } from './reactive.js'`,
    )
    expect(await readFile(path.resolve(fixtureDir, 'dist/vapor.d.ts'), 'utf8')).toContain(
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
    await writeFixture(fixtureDir, 'src/js-runtime/app.ts', source)

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
      'src/js-runtime/app.ts',
      `export const identity = (value: any) => value\n`,
    )

    const tool = await loadTool()
    const audit = await tool.auditTypeScriptRuntime({
      runtimeDir: fixtureDir,
      targets: ['js-runtime/app.js'],
      explicitAnyAllowlist: ['src/js-runtime/app.ts:1'],
    })

    expect(audit.violations).toEqual([])
    await expect(
      tool.emitTypeScriptRuntime({
        runtimeDir: fixtureDir,
        targets: ['js-runtime/app.js'],
        explicitAnyAllowlist: ['src/js-runtime/app.ts:1'],
      }),
    ).resolves.toMatchObject({
      outputFiles: ['dist/js-runtime/app.d.ts', 'dist/js-runtime/app.js'],
    })
  })
})
