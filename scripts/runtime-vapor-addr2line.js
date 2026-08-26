import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const DEFAULT_WASM_PATH = path.resolve(
  rootDir,
  'packages/runtime-vapor/pkg-vapor/rue_runtime_vapor_bg.wasm',
)

const usage = () => {
  console.log(
    [
      'Usage:',
      '  pnpm runtime-vapor-addr2line -- 0x2547b 0x39e4b',
      '  pnpm runtime-vapor-addr2line -- --stack "RuntimeError: unreachable\\n at ...:0x2547b"',
      '  pnpm runtime-vapor-addr2line -- --stack-file ./stack.txt',
      '  pnpm runtime-vapor-addr2line -- --wasm packages/runtime-vapor/pkg-vapor/rue_runtime_vapor_bg.wasm 0x2547b',
    ].join('\n'),
  )
}

const args = process.argv.slice(2)
let wasmPath = DEFAULT_WASM_PATH
let stackText = ''
let codeSectionRelative = false
const positionalAddresses = []

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === '--') {
    continue
  }
  if (arg === '--wasm') {
    wasmPath = path.resolve(rootDir, args[index + 1] ?? '')
    index += 1
    continue
  }
  if (arg === '--stack') {
    stackText = args[index + 1] ?? ''
    index += 1
    continue
  }
  if (arg === '--stack-file') {
    const stackFilePath = path.resolve(rootDir, args[index + 1] ?? '')
    stackText = fs.readFileSync(stackFilePath, 'utf8')
    index += 1
    continue
  }
  if (arg === '--code-section-relative') {
    codeSectionRelative = true
    continue
  }
  if (arg === '--help' || arg === '-h') {
    usage()
    process.exit(0)
  }
  positionalAddresses.push(arg)
}

const extractedAddresses = [
  ...new Set([
    ...positionalAddresses,
    ...Array.from(stackText.matchAll(/0x[0-9a-fA-F]+/g), match => match[0]),
  ]),
]

if (!extractedAddresses.length) {
  usage()
  console.error(
    '\nNo wasm addresses found. Provide one or more 0x... offsets or pass --stack/--stack-file.',
  )
  process.exit(1)
}

if (!fs.existsSync(wasmPath)) {
  console.error(`WASM file not found: ${wasmPath}`)
  process.exit(1)
}

const wasmTools = spawnSync('command', ['-v', 'wasm-tools'], {
  cwd: rootDir,
  encoding: 'utf8',
  shell: process.platform === 'win32',
})

if (wasmTools.status !== 0) {
  console.error('wasm-tools is required. Install it with: cargo install wasm-tools')
  process.exit(1)
}

const addr2lineArgs = ['addr2line']
if (codeSectionRelative) {
  addr2lineArgs.push('--code-section-relative')
}
addr2lineArgs.push(wasmPath, ...extractedAddresses)

console.log(`WASM: ${wasmPath}`)
console.log(`Addresses: ${extractedAddresses.join(', ')}`)
console.log('')

const result = spawnSync('wasm-tools', addr2lineArgs, {
  cwd: rootDir,
  encoding: 'utf8',
})

if (result.stdout) {
  process.stdout.write(result.stdout)
}

if (result.status !== 0) {
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  process.exit(result.status ?? 1)
}

if (result.stderr) {
  process.stderr.write(result.stderr)
}

const outputLines = result.stdout
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)

if (
  outputLines.length === extractedAddresses.length &&
  outputLines.every(line => line.includes('no dwarf frames found for this address'))
) {
  console.error(
    '\nNo DWARF frames matched these addresses in the current wasm file. This usually means the stack came from a different runtime-vapor build. Rebuild/restart with `pnpm app-dev`, reproduce again, then pass the fresh stack into this command.',
  )
}
