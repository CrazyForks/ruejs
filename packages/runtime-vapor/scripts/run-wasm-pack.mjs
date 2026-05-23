import { spawnSync } from 'node:child_process'

const isWin = process.platform === 'win32'
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('[runtime-vapor] Missing wasm-pack arguments.')
  process.exit(1)
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

const execResult = run('wasm-pack', args, { stdio: 'inherit' })
if (execResult.error) {
  console.error('[runtime-vapor] Failed to execute wasm-pack.')
  process.exit(1)
}

process.exit(execResult.status ?? 1)
