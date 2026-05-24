import { spawnSync } from 'node:child_process'

const isWin = process.platform === 'win32'
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

ensureWasmPack()

const execResult = run('wasm-pack', normalizeWasmPackArgs(args), { stdio: 'inherit' })
if (execResult.error) {
  console.error('[runtime-vapor] Failed to execute wasm-pack.')
  process.exit(1)
}

process.exit(execResult.status ?? 1)
