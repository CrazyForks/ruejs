import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const isWin = process.platform === 'win32'
const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageDir = join(scriptDir, '..')
const runnerBinaryName = isWin ? 'wasm-bindgen-test-runner.exe' : 'wasm-bindgen-test-runner'
const wasmBindgenBinaryName = isWin ? 'wasm-bindgen.exe' : 'wasm-bindgen'
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('[runtime-vapor] Missing wasm-pack arguments.')
  process.exit(1)
}

// 某些 wasm-pack 版本不接受重复的 --features，这里预先合并为单个 cargo 特性列表。
function normalizeWasmPackArgs(rawArgs) {
  let firstFeatureIndex = -1
  const features = []
  const normalized = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index]

    if (current === '--features') {
      const next = rawArgs[index + 1]
      if (!next) {
        normalized.push(current)
        continue
      }

      if (firstFeatureIndex === -1) {
        firstFeatureIndex = normalized.length
      }
      features.push(next)
      index += 1
      continue
    }

    if (current.startsWith('--features=')) {
      if (firstFeatureIndex === -1) {
        firstFeatureIndex = normalized.length
      }
      features.push(current.slice('--features='.length))
      continue
    }

    normalized.push(current)
  }

  if (features.length <= 1) {
    return rawArgs
  }

  const mergedFeatures = features
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)
    .join(',')

  normalized.splice(firstFeatureIndex, 0, '--features', mergedFeatures)
  return normalized
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    shell: isWin,
    ...options,
  })
}

function hasExplicitMode(rawArgs) {
  return rawArgs.some(arg => arg === '--mode' || arg === '-m' || arg.startsWith('--mode='))
}

function isNodeTest(rawArgs) {
  return (
    rawArgs[0] === 'test' &&
    rawArgs.includes('--node') &&
    !rawArgs.includes('--firefox') &&
    !rawArgs.includes('--chrome') &&
    !rawArgs.includes('--safari') &&
    !hasExplicitMode(rawArgs)
  )
}

function validateVaporArtifactArgs(rawArgs) {
  const outDirIndex = rawArgs.findIndex(arg => arg === '--out-dir')
  const outDir = outDirIndex >= 0 ? rawArgs[outDirIndex + 1] : undefined
  const hasVaporOutDir = outDir === 'pkg-vapor' || rawArgs.includes('--out-dir=pkg-vapor')
  if (!hasVaporOutDir) {
    return
  }

  const normalized = normalizeWasmPackArgs(rawArgs)
  const featureIndex = normalized.findIndex(arg => arg === '--features')
  const features =
    featureIndex >= 0
      ? (normalized[featureIndex + 1] ?? '').split(',')
      : (normalized.find(arg => arg.startsWith('--features=')) ?? '')
          .slice('--features='.length)
          .split(',')

  if (!normalized.includes('--no-default-features') || !features.includes('vapor')) {
    console.error(
      '[runtime-vapor] pkg-vapor must be built with --no-default-features --features vapor.',
    )
    process.exit(1)
  }
  if (features.includes('runtime')) {
    console.error('[runtime-vapor] pkg-vapor cannot include the complete runtime feature.')
    process.exit(1)
  }
}

function versionScore(value) {
  const match = value.match(/wasm-bindgen-cargo-install-(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    return [0, 0, 0]
  }
  return match.slice(1).map(Number)
}

function compareRunnerCandidates(a, b) {
  const aVersion = versionScore(a)
  const bVersion = versionScore(b)
  for (let index = 0; index < aVersion.length; index += 1) {
    if (aVersion[index] !== bVersion[index]) {
      return bVersion[index] - aVersion[index]
    }
  }
  return statSync(b).mtimeMs - statSync(a).mtimeMs
}

function collectCachedRunners(root, out = []) {
  if (!root || !existsSync(root)) {
    return out
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name)
    if (entry.isFile() && entry.name === runnerBinaryName) {
      out.push(entryPath)
    } else if (entry.isDirectory()) {
      collectCachedRunners(entryPath, out)
    }
  }

  return out
}

function findWasmBindgenTestRunner() {
  const pathResult = run(runnerBinaryName, ['--help'], { stdio: 'ignore' })
  if (!pathResult.error && pathResult.status === 0) {
    return runnerBinaryName
  }

  const cacheRoots = [
    process.env.WASM_PACK_CACHE,
    join(homedir(), 'Library', 'Caches', '.wasm-pack'),
    join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), '.wasm-pack'),
  ]
  const candidates = cacheRoots.flatMap(root => collectCachedRunners(root))
  candidates.sort(compareRunnerCandidates)
  return candidates[0]
}

function ensureWasmTarget() {
  const targetResult = run('rustup', ['target', 'list', '--installed'], { stdio: 'pipe' })
  if (
    !targetResult.error &&
    targetResult.status === 0 &&
    targetResult.stdout.toString().split(/\r?\n/).includes('wasm32-unknown-unknown')
  ) {
    return
  }

  const installResult = run('rustup', ['target', 'add', 'wasm32-unknown-unknown'], {
    stdio: 'inherit',
  })
  if (installResult.error || installResult.status !== 0) {
    console.error('[runtime-vapor] Failed to install the wasm32-unknown-unknown target.')
    process.exit(installResult.status ?? 1)
  }
}

function cargoArgsForNodeTest(rawArgs) {
  const cargoArgs = ['test', '--target', 'wasm32-unknown-unknown']
  for (const arg of rawArgs.slice(1)) {
    if (arg === '--node' || arg === '--headless') {
      continue
    }
    cargoArgs.push(arg)
  }
  return normalizeWasmPackArgs(cargoArgs)
}

function ensureWasmPack() {
  const versionResult = run('wasm-pack', ['--version'], { stdio: 'pipe' })
  if (!versionResult.error && versionResult.status === 0) {
    return
  }

  const cargoVersionResult = run('cargo', ['--version'], { stdio: 'pipe' })
  if (cargoVersionResult.error || cargoVersionResult.status !== 0) {
    console.error(
      '[runtime-vapor] wasm-pack is missing, and cargo is not available to install it automatically.',
    )
    process.exit(1)
  }

  console.log('[runtime-vapor] wasm-pack not found. Installing via cargo install wasm-pack...')
  const installResult = run('cargo', ['install', 'wasm-pack'], { stdio: 'inherit' })
  if (installResult.error || installResult.status !== 0) {
    console.error('[runtime-vapor] Failed to install wasm-pack automatically.')
    process.exit(installResult.status ?? 1)
  }
}

function readLockedWasmBindgenVersion() {
  const lockfile = readFileSync(join(packageDir, 'Cargo.lock'), 'utf8')
  const packageBlocks = lockfile.split(/\n\[\[package\]\]\n/)
  for (const block of packageBlocks) {
    if (/^name = "wasm-bindgen"$/m.test(block)) {
      return block.match(/^version = "([^"]+)"$/m)?.[1]
    }
  }
  return undefined
}

function ensureLockedWasmBindgen() {
  const version = readLockedWasmBindgenVersion()
  if (!version) {
    console.error('[runtime-vapor] Cargo.lock does not contain wasm-bindgen.')
    process.exit(1)
  }

  const installRoot = join(packageDir, 'target', `wasm-bindgen-cli-${version}-locked`)
  const binary = join(installRoot, 'bin', wasmBindgenBinaryName)
  if (!existsSync(binary)) {
    console.log(`[runtime-vapor] Installing locked wasm-bindgen-cli ${version}...`)
    const installResult = run(
      'cargo',
      ['install', 'wasm-bindgen-cli', '--version', version, '--locked', '--root', installRoot],
      { stdio: 'inherit' },
    )
    if (installResult.error || installResult.status !== 0) {
      console.error('[runtime-vapor] Failed to install the locked wasm-bindgen CLI.')
      process.exit(installResult.status ?? 1)
    }
  }

  return join(installRoot, 'bin')
}

if (isNodeTest(args)) {
  const runner = findWasmBindgenTestRunner()
  if (runner) {
    ensureWasmTarget()
    const execResult = run('cargo', cargoArgsForNodeTest(args), {
      stdio: 'inherit',
      env: {
        ...process.env,
        CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER: runner,
        WASM_BINDGEN_TEST_ONLY_NODE: '1',
      },
    })
    if (execResult.error) {
      console.error('[runtime-vapor] Failed to execute cargo wasm tests.')
      process.exit(1)
    }
    process.exit(execResult.status ?? 1)
  }
}

validateVaporArtifactArgs(args)
ensureWasmPack()

const lockedWasmBindgenBin = ensureLockedWasmBindgen()
const execResult = run('wasm-pack', normalizeWasmPackArgs(args), {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${lockedWasmBindgenBin}${isWin ? ';' : ':'}${process.env.PATH ?? ''}`,
  },
})
if (execResult.error) {
  console.error('[runtime-vapor] Failed to execute wasm-pack.')
  process.exit(1)
}

process.exit(execResult.status ?? 1)
