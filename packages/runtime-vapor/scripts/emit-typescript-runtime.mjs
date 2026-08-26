import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createScanner, LanguageVariant, SyntaxKind } from 'typescript/unstable/ast'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const typescriptPackageDir = path.dirname(
  fileURLToPath(import.meta.resolve('typescript/package.json')),
)
const typescriptCli = path.resolve(typescriptPackageDir, 'bin/tsc')
const nodeTypesRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.resolve('@types/node/package.json'))),
)

export const RUNTIME_TYPESCRIPT_TARGETS = Object.freeze(
  [
    'index.js',
    'index.node.js',
    'reactive.js',
    'reactive.node.js',
    'reactive.vapor.js',
    'runtime-entry-wrap.js',
    'vapor-bridge.js',
    'vapor.js',
    'vapor.node.js',
    'js-reactive/facade.js',
    'js-reactive/hooks/computed.js',
    'js-reactive/hooks/context.js',
    'js-reactive/hooks/effect.js',
    'js-reactive/hooks/index.js',
    'js-reactive/hooks/state.js',
    'js-reactive/hooks/values.js',
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
  ].sort(),
)

export const EXPLICIT_ANY_ALLOWLIST = Object.freeze([])
export const RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS = Object.freeze(['js-reactive/types.d.ts'])

const pathExists = async filePath => {
  try {
    await stat(filePath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

const sourceForTarget = target => target.replace(/\.js$/, '.ts')
const declarationForTarget = target => target.replace(/\.js$/, '.d.ts')

const lineAt = (source, offset) => {
  let line = 1
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1
  }
  return line
}

const validateTargets = targets => {
  const seen = new Set()
  for (const target of targets) {
    if (
      typeof target !== 'string' ||
      !target.endsWith('.js') ||
      path.isAbsolute(target) ||
      target.split('/').includes('..')
    ) {
      throw new Error(`Invalid runtime-vapor TypeScript target: ${String(target)}`)
    }
    if (seen.has(target)) throw new Error(`Duplicate runtime-vapor TypeScript target: ${target}`)
    seen.add(target)
  }
}

const scanSource = (source, relativeSource, explicitAnyAllowlist) => {
  const violations = []
  const scanner = createScanner(false, LanguageVariant.Standard, source)
  let token = scanner.scan()

  while (token !== SyntaxKind.EndOfFile) {
    const tokenText = scanner.getTokenText()
    const line = lineAt(source, scanner.getTokenStart())

    if (
      token === SyntaxKind.SingleLineCommentTrivia ||
      token === SyntaxKind.MultiLineCommentTrivia
    ) {
      if (/@ts-ignore\b/.test(tokenText)) {
        violations.push({ rule: '@ts-ignore', source: relativeSource, line })
      }
      if (/@ts-nocheck\b/.test(tokenText)) {
        violations.push({ rule: '@ts-nocheck', source: relativeSource, line })
      }
    } else if (
      token === SyntaxKind.AnyKeyword &&
      !explicitAnyAllowlist.has(`${relativeSource}:${line}`)
    ) {
      violations.push({ rule: 'explicit-any', source: relativeSource, line })
    }

    token = scanner.scan()
  }

  return violations
}

export const auditTypeScriptRuntime = async ({
  runtimeDir = packageDir,
  targets = RUNTIME_TYPESCRIPT_TARGETS,
  explicitAnyAllowlist = EXPLICIT_ANY_ALLOWLIST,
} = {}) => {
  validateTargets(targets)
  const allowlist = new Set(explicitAnyAllowlist)
  const violations = []
  let migratedCount = 0

  for (const target of targets) {
    const relativeSource = sourceForTarget(target)
    const sourcePath = path.resolve(runtimeDir, relativeSource)
    const outputPath = path.resolve(runtimeDir, target)
    const hasSource = await pathExists(sourcePath)
    const hasOutput = await pathExists(outputPath)

    if (!hasSource && !hasOutput) {
      violations.push({ rule: 'missing-target', source: relativeSource, line: 1 })
      continue
    }
    if (!hasSource) continue

    migratedCount += 1
    const source = await readFile(sourcePath, 'utf8')
    violations.push(...scanSource(source, relativeSource, allowlist))
  }

  return { targetCount: targets.length, migratedCount, violations }
}

const formatViolations = violations =>
  violations.map(({ rule, source, line }) => `${source}:${line} ${rule}`).join('\n')

const compileToDirectory = (runtimeDir, outputDir, relativeSources) => {
  const environmentFile = path.resolve(runtimeDir, 'runtime-vapor-env.d.ts')
  const rootFiles = relativeSources.map(source => path.resolve(runtimeDir, source))
  const compilerArgs = [
    typescriptCli,
    '--ignoreConfig',
    '--target',
    'ES2022',
    '--module',
    'ESNext',
    '--moduleResolution',
    'Bundler',
    '--lib',
    'ES2022,DOM,DOM.Iterable,ES2021.WeakRef',
    '--strict',
    '--noImplicitAny',
    '--noUncheckedIndexedAccess',
    '--useUnknownInCatchVariables',
    '--verbatimModuleSyntax',
    '--skipLibCheck',
    '--types',
    'node',
    '--typeRoots',
    nodeTypesRoot,
    '--declaration',
    '--noEmitOnError',
    '--newLine',
    'lf',
    '--rootDir',
    runtimeDir,
    '--outDir',
    outputDir,
    ...rootFiles,
  ]
  if (existsSync(environmentFile)) compilerArgs.push(environmentFile)

  const result = spawnSync(process.execPath, compilerArgs, {
    cwd: runtimeDir,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`TypeScript runtime emit failed:\n${`${result.stdout}${result.stderr}`.trim()}`)
  }
}

export const emitTypeScriptRuntime = async ({
  runtimeDir = packageDir,
  targets = RUNTIME_TYPESCRIPT_TARGETS,
  explicitAnyAllowlist = EXPLICIT_ANY_ALLOWLIST,
} = {}) => {
  const audit = await auditTypeScriptRuntime({ runtimeDir, targets, explicitAnyAllowlist })
  if (audit.violations.length > 0) {
    throw new Error(`runtime-vapor TypeScript audit failed:\n${formatViolations(audit.violations)}`)
  }

  const relativeSources = []
  for (const target of targets) {
    const source = sourceForTarget(target)
    if (await pathExists(path.resolve(runtimeDir, source))) relativeSources.push(source)
  }
  if (relativeSources.length === 0) return { outputFiles: [] }

  const outputDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-vapor-emit-'))
  try {
    compileToDirectory(runtimeDir, outputDir, relativeSources)

    const outputFiles = []
    for (const target of targets) {
      const relativeSource = sourceForTarget(target)
      if (!relativeSources.includes(relativeSource)) continue

      for (const output of [target, declarationForTarget(target)]) {
        const generatedPath = path.resolve(outputDir, output)
        if (!(await pathExists(generatedPath))) {
          throw new Error(`TypeScript did not emit expected runtime artifact: ${output}`)
        }
        const destinationPath = path.resolve(runtimeDir, output)
        await mkdir(path.dirname(destinationPath), { recursive: true })
        await copyFile(generatedPath, destinationPath)
        outputFiles.push(output)
      }
    }

    for (const output of RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS) {
      const generatedPath = path.resolve(outputDir, output)
      if (!(await pathExists(generatedPath))) continue
      const destinationPath = path.resolve(runtimeDir, output)
      await mkdir(path.dirname(destinationPath), { recursive: true })
      await copyFile(generatedPath, destinationPath)
      outputFiles.push(output)
    }

    return { outputFiles: outputFiles.sort() }
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  const checkOnly = process.argv.slice(2).includes('--check')
  const audit = await auditTypeScriptRuntime()
  if (audit.violations.length > 0) {
    console.error(formatViolations(audit.violations))
    process.exitCode = 1
  } else if (checkOnly) {
    console.log(
      `runtime-vapor TypeScript check: ${audit.targetCount} targets, ${audit.migratedCount} migrated`,
    )
  } else {
    const emitted = await emitTypeScriptRuntime()
    console.log(
      `runtime-vapor TypeScript emit: ${audit.targetCount} targets, ${audit.migratedCount} migrated, ${emitted.outputFiles.length} artifacts`,
    )
  }
}
