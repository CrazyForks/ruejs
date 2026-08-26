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
const runtimeVaporBuildInputs = ['src', 'Cargo.toml', 'Cargo.lock']
const runtimeVaporTypeScriptInputs = [
  'tsconfig.json',
  'runtime-vapor-env.d.ts',
  'global.d.ts',
  'scripts/emit-typescript-runtime.mjs',
  ...runtimeTypeScriptTargets.map(target => target.replace(/\.js$/, '.ts')),
  ...runtimeTypeScriptAuxiliaryDeclarations.map(output => output.replace(/\.d\.ts$/, '.ts')),
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

const runtimeVaporInputMtimeMs = runtimeVaporBuildInputs.reduce((latestMtimeMs, entry) => {
  const entryPath = path.resolve(runtimeVaporRoot, entry)
  return Math.max(latestMtimeMs, getLatestMtimeMs(entryPath))
}, 0)
const runtimeVaporTypeScriptInputMtimeMs = runtimeVaporTypeScriptInputs.reduce(
  (latestMtimeMs, entry) => {
    const entryPath = path.resolve(runtimeVaporRoot, entry)
    return Math.max(latestMtimeMs, getLatestMtimeMs(entryPath))
  },
  0,
)

/** @param {string} wasmFilePath */
const wasmHasDebugInfo = wasmFilePath => {
  if (!fs.existsSync(wasmFilePath)) {
    return false
  }

  const wasmBuffer = fs.readFileSync(wasmFilePath)
  const wasmText = wasmBuffer.toString('latin1')
  return (
    wasmText.includes('.debug_info') ||
    wasmText.includes('.debug_line') ||
    wasmText.includes('.debug_str') ||
    wasmText.includes('external_debug_info')
  )
}

const requiredBuilds = [
  {
    file: 'index.js',
    script: 'build-ts',
    requiresDebugInfo: false,
    inputMtimeMs: runtimeVaporTypeScriptInputMtimeMs,
    outputs: [
      'index.js',
      'index.d.ts',
      'index.node.js',
      'js-reactive/types.d.ts',
      'reactive.js',
      'reactive.d.ts',
      'reactive.node.js',
      'reactive.vapor.js',
      'vapor.js',
      'vapor.d.ts',
      'vapor.node.js',
    ],
  },
  {
    file: 'pkg-vapor/rue_runtime_vapor_bg.wasm',
    script: 'build-profiling',
    requiresDebugInfo: true,
    inputMtimeMs: runtimeVaporInputMtimeMs,
    outputs: [
      'pkg-vapor/rue_runtime_vapor.js',
      'pkg-vapor/rue_runtime_vapor_bg.js',
      'pkg-vapor/rue_runtime_vapor_bg.wasm',
    ],
  },
  ...(shouldBuildNodeRuntime
    ? [
        {
          file: 'pkg-node/rue_runtime_vapor_bg.wasm',
          script: 'build-node',
          requiresDebugInfo: false,
          inputMtimeMs: runtimeVaporInputMtimeMs,
          outputs: [
            'pkg-node/rue_runtime_vapor.js',
            'pkg-node/rue_runtime_vapor_bg.wasm',
            'pkg-node/package.json',
          ],
        },
      ]
    : []),
]

const missingOrStaleBuilds = requiredBuilds.filter(
  ({ outputs, requiresDebugInfo, inputMtimeMs }) => {
    const resolvedOutputs = outputs.map(file => path.resolve(runtimeVaporRoot, file))
    if (resolvedOutputs.some(file => !fs.existsSync(file))) {
      return true
    }

    if (
      requiresDebugInfo &&
      !wasmHasDebugInfo(path.resolve(runtimeVaporRoot, outputs[outputs.length - 1] ?? ''))
    ) {
      return true
    }

    const oldestOutputMtimeMs = resolvedOutputs.reduce((oldestMtimeMs, file) => {
      return Math.min(oldestMtimeMs, fs.statSync(file).mtimeMs)
    }, Number.POSITIVE_INFINITY)

    return oldestOutputMtimeMs < inputMtimeMs
  },
)

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
