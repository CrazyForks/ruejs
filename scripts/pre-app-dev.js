// @ts-check

import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimeVaporRoot = path.resolve(__dirname, '../packages/runtime-vapor')
const { RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS, RUNTIME_TYPESCRIPT_TARGETS } = await import(
  path.resolve(runtimeVaporRoot, 'scripts/emit-typescript-runtime.mjs')
)
const runtimeTypeScriptTargets = /** @type {string[]} */ (RUNTIME_TYPESCRIPT_TARGETS)
const runtimeTypeScriptAuxiliaryDeclarations = /** @type {string[]} */ (
  RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS
)
const runtimeVaporTypeScriptInputs = [
  'package.json',
  'tsconfig.json',
  'src/global.d.ts',
  'scripts/emit-typescript-runtime.mjs',
  ...runtimeTypeScriptTargets.map(target => `src/${target.replace(/\.js$/, '.ts')}`),
  ...runtimeTypeScriptAuxiliaryDeclarations.map(
    output => `src/${output.replace(/\.d\.ts$/, '.ts')}`,
  ),
]
const shouldBuildNodeRuntime = process.argv.includes('--node-runtime')

const generateDocsSearchIndex = () => {
  const result = spawnSync('node', ['scripts/generate-doc-search-index.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

generateDocsSearchIndex()

/** @param {string} targetPath */
const getLatestMtimeMs = targetPath => {
  const stat = fs.statSync(targetPath)
  if (!stat.isDirectory()) {
    return stat.mtimeMs
  }

  let latestMtimeMs = stat.mtimeMs
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const entryPath = path.join(targetPath, entry.name)
    const entryMtimeMs = getLatestMtimeMs(entryPath)
    if (entryMtimeMs > latestMtimeMs) {
      latestMtimeMs = entryMtimeMs
    }
  }

  return latestMtimeMs
}

const runtimeVaporTypeScriptInputMtimeMs = runtimeVaporTypeScriptInputs.reduce(
  (latestMtimeMs, entry) => {
    const entryPath = path.resolve(runtimeVaporRoot, entry)
    return Math.max(latestMtimeMs, getLatestMtimeMs(entryPath))
  },
  0,
)

const requiredBuilds = [
  {
    file: 'dist/index.js',
    script: shouldBuildNodeRuntime ? 'build-ts' : 'build-ts:browser',
    inputMtimeMs: runtimeVaporTypeScriptInputMtimeMs,
    outputs: [
      'dist/index.js',
      'dist/index.d.ts',
      'dist/global.d.ts',
      'dist/js-reactive/types.d.ts',
      'dist/reactive.js',
      'dist/reactive.d.ts',
      'dist/reactive.vapor.js',
      'dist/vapor.js',
      'dist/vapor.d.ts',
      ...(shouldBuildNodeRuntime
        ? ['dist/index.node.js', 'dist/reactive.node.js', 'dist/vapor.node.js']
        : []),
    ],
  },
]

const missingOrStaleBuilds = requiredBuilds.filter(({ outputs, inputMtimeMs }) => {
  const resolvedOutputs = outputs.map(file => path.resolve(runtimeVaporRoot, file))
  if (resolvedOutputs.some(file => !fs.existsSync(file))) {
    return true
  }

  const oldestOutputMtimeMs = resolvedOutputs.reduce((oldestMtimeMs, file) => {
    return Math.min(oldestMtimeMs, fs.statSync(file).mtimeMs)
  }, Number.POSITIVE_INFINITY)

  return oldestOutputMtimeMs < inputMtimeMs
})

if (!missingOrStaleBuilds.length) {
  process.exit(0)
}

for (const { script, file, outputs } of missingOrStaleBuilds) {
  const resolvedOutputs = outputs.map(output => path.resolve(runtimeVaporRoot, output))
  const isMissing = resolvedOutputs.some(output => !fs.existsSync(output))
  const reason = isMissing ? 'Missing' : 'Stale'

  console.log(`[preapp] ${reason} ${file}, running @rue-js/runtime-vapor:${script}`)

  const result = spawnSync('pnpm', ['run', script], {
    cwd: runtimeVaporRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
