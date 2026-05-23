import { spawnSync } from 'node:child_process'

const target = 'wasm32-wasip1'
const isWin = process.platform === 'win32'

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: isWin,
    ...options,
  })
}

const rustupCheck = run('rustup', ['--version'])

if (rustupCheck.error || rustupCheck.status !== 0) {
  console.error('[swc-plugin-rue] rustup is required to manage Rust targets.')
  process.exit(1)
}

const listResult = run('rustup', ['target', 'list', '--installed'])

if (listResult.error || listResult.status !== 0) {
  console.error('[swc-plugin-rue] Failed to query installed Rust targets.')
  process.stderr.write(listResult.stderr || '')
  process.exit(1)
}

const installedTargets = new Set(
  listResult.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean),
)

if (installedTargets.has(target)) {
  process.exit(0)
}

console.log(`[swc-plugin-rue] Installing missing Rust target: ${target}`)

const addResult = spawnSync('rustup', ['target', 'add', target], {
  stdio: 'inherit',
  shell: isWin,
})

if (addResult.error || addResult.status !== 0) {
  console.error(`[swc-plugin-rue] Failed to install Rust target: ${target}`)
  process.exit(addResult.status ?? 1)
}
