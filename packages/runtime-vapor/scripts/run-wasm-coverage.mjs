import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(scriptDir, '..')
const targetDir = path.join(packageDir, 'target', 'wasm-cov')
const runsDir = path.join(targetDir, 'runs')
const latestFile = path.join(targetDir, 'latest.json')
const reportIgnoreFilenameRegex =
  process.env.WASM_COVERAGE_IGNORE_REGEX || '/(rustc|\\.cargo/registry|target)/'

function getExecutableName(baseName) {
  return process.platform === 'win32' ? `${baseName}.exe` : baseName
}

function resolveExecutable(binDir, baseName) {
  return path.join(binDir, getExecutableName(baseName))
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: packageDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
    stdio: 'pipe',
    ...options,
  })
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatTimestamp(date) {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('') +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

function sanitizeLabel(value) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseArgs(argv) {
  const passthrough = []
  let label = ''
  let emitHtml = false
  let emitLcov = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--label') {
      const next = argv[index + 1]
      if (!next) {
        console.error('[runtime-vapor] Missing value for --label.')
        process.exit(1)
      }
      label = sanitizeLabel(next)
      index += 1
      continue
    }

    if (current === '--html') {
      emitHtml = true
      continue
    }

    if (current === '--lcov') {
      emitLcov = true
      continue
    }

    passthrough.push(current)
  }

  return { label, passthrough, emitHtml, emitLcov }
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true })
}

function resolveRunDir(label) {
  const stamp = formatTimestamp(new Date())
  const prefix = label ? `${stamp}-${label}` : stamp
  let candidate = path.join(runsDir, prefix)
  let suffix = 2

  while (existsSync(candidate)) {
    candidate = path.join(runsDir, `${prefix}-${suffix}`)
    suffix += 1
  }

  ensureDir(candidate)
  return candidate
}

function getWasmAwareLlvmBin() {
  const candidates = [
    process.env.COVERAGE_LLVM_BIN,
    process.env.LLVM_BIN,
    '/opt/homebrew/opt/llvm/bin',
    '/opt/homebrew/Cellar/llvm/22.1.5/bin',
  ].filter(Boolean)

  for (const binDir of candidates) {
    const clangPath = resolveExecutable(binDir, 'clang')
    const result = run(clangPath, ['--print-targets'])
    if (result.status === 0 && /wasm32/i.test(result.stdout)) {
      return binDir
    }
  }

  return ''
}

function getRustLlvmBin(env) {
  const sysrootResult = run('rustc', ['--print', 'sysroot'], { env })
  if (sysrootResult.status !== 0) {
    return ''
  }

  const versionResult = run('rustc', ['-Vv'], { env })
  if (versionResult.status !== 0) {
    return ''
  }

  const hostTriple = versionResult.stdout.match(/^host:\s+(.+)$/m)?.[1]?.trim()
  if (!hostTriple) {
    return ''
  }

  const llvmBin = path.join(sysrootResult.stdout.trim(), 'lib', 'rustlib', hostTriple, 'bin')
  const llvmProfdata = resolveExecutable(llvmBin, 'llvm-profdata')
  const llvmCov = resolveExecutable(llvmBin, 'llvm-cov')
  if (existsSync(llvmProfdata) && existsSync(llvmCov)) {
    return llvmBin
  }

  return ''
}

function mergeRustFlags(existingFlags, requiredFlags) {
  const nextFlags = existingFlags.trim() ? existingFlags.trim().split(/\s+/) : []
  for (const flag of requiredFlags) {
    if (!nextFlags.includes(flag)) {
      nextFlags.push(flag)
    }
  }
  return nextFlags.join(' ')
}

function collectProfrawFiles(dirPath, matches = []) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectProfrawFiles(fullPath, matches)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.profraw')) {
      matches.push(fullPath)
    }
  }
  return matches
}

function collectWasmArtifacts(logOutput) {
  const matches = new Set()
  const regex = /\(([^()\r\n]+\.wasm)\)/g

  for (const match of logOutput.matchAll(regex)) {
    const candidate = match[1].trim()
    if (!candidate.includes('wasm32-unknown-unknown')) {
      continue
    }

    const resolved = path.resolve(packageDir, candidate)
    if (existsSync(resolved)) {
      matches.add(resolved)
    }
  }

  return [...matches].sort()
}

function writeMetadata(metadata) {
  writeFileSync(path.join(runDir, 'meta.json'), `${JSON.stringify(metadata, null, 2)}\n`)
  writeFileSync(latestFile, `${JSON.stringify(metadata, null, 2)}\n`)
}

const { label, passthrough, emitHtml, emitLcov } = parseArgs(process.argv.slice(2))
const runDir = resolveRunDir(label)
const rawDir = path.join(runDir, 'raw')
ensureDir(rawDir)

const llvmBin = getWasmAwareLlvmBin()
const rustLlvmBin = getRustLlvmBin({
  ...process.env,
  RUSTUP_TOOLCHAIN: process.env.RUSTUP_TOOLCHAIN || 'nightly',
})
const env = { ...process.env }
if (llvmBin) {
  env.PATH = `${llvmBin}${path.delimiter}${env.PATH ?? ''}`
}

env.RUSTUP_TOOLCHAIN = env.RUSTUP_TOOLCHAIN || 'nightly'
env.LLVM_PROFILE_FILE = env.LLVM_PROFILE_FILE || path.join(rawDir, 'wasm_%m_%p.profraw')
env.RUSTFLAGS = mergeRustFlags(env.RUSTFLAGS || '', [
  '--cfg=wasm_bindgen_unstable_test_coverage',
  '-Cinstrument-coverage',
  '-Zno-profiler-runtime',
  '-Clink-arg=--no-gc-sections',
])

const wasmPackArgs = ['test', '--node', '--features', 'wasm-coverage', ...passthrough]

console.log(`[runtime-vapor] Writing wasm coverage run to ${path.relative(packageDir, runDir)}`)
console.log(`[runtime-vapor] LLVM_PROFILE_FILE=${env.LLVM_PROFILE_FILE}`)
if (llvmBin) {
  console.log(`[runtime-vapor] Using LLVM toolchain from ${llvmBin}`)
}
if (rustLlvmBin) {
  console.log(`[runtime-vapor] Using rustc LLVM tools from ${rustLlvmBin}`)
}

const execResult = spawnSync(process.execPath, ['./scripts/run-wasm-pack.mjs', ...wasmPackArgs], {
  cwd: packageDir,
  env,
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 50,
  stdio: 'pipe',
})

if (execResult.stdout) {
  process.stdout.write(execResult.stdout)
}
if (execResult.stderr) {
  process.stderr.write(execResult.stderr)
}

const profrawFiles = collectProfrawFiles(rawDir)
const combinedLogOutput = `${execResult.stdout ?? ''}\n${execResult.stderr ?? ''}`
const wasmArtifacts = collectWasmArtifacts(combinedLogOutput)
const profdataFile = path.join(runDir, 'coverage.profdata')
const reportFile = path.join(runDir, 'coverage-report.txt')
const htmlDir = path.join(runDir, 'html')
const lcovFile = path.join(runDir, 'coverage.lcov.info')
const metadata = {
  createdAt: new Date().toISOString(),
  command: [process.execPath, './scripts/run-wasm-pack.mjs', ...wasmPackArgs],
  runDir: path.relative(packageDir, runDir),
  rawDir: path.relative(packageDir, rawDir),
  profrawCount: profrawFiles.length,
  profrawFiles: profrawFiles.map(filePath => path.relative(packageDir, filePath)),
  wasmArtifacts: wasmArtifacts.map(filePath => path.relative(packageDir, filePath)),
  rustupToolchain: env.RUSTUP_TOOLCHAIN,
  llvmProfileFile: env.LLVM_PROFILE_FILE,
  rustflags: env.RUSTFLAGS,
  llvmBin: llvmBin || null,
  rustLlvmBin: rustLlvmBin || null,
  profdataFile: null,
  reportFile: null,
  htmlDir: null,
  lcovFile: null,
  requestedOutputs: {
    text: true,
    html: emitHtml,
    lcov: emitLcov,
  },
  ignoreFilenameRegex: reportIgnoreFilenameRegex,
}

writeMetadata(metadata)

if (execResult.status !== 0) {
  console.error(
    `[runtime-vapor] wasm coverage run failed. Archive kept at ${path.relative(packageDir, runDir)}`,
  )
  process.exit(execResult.status ?? 1)
}

if (profrawFiles.length === 0) {
  console.error(
    `[runtime-vapor] wasm tests passed but no profraw files were written. See ${path.relative(packageDir, runDir)}`,
  )
  process.exit(1)
}

if (!rustLlvmBin) {
  console.error('[runtime-vapor] Could not locate rustc LLVM tools for llvm-profdata/llvm-cov.')
  process.exit(1)
}

if (wasmArtifacts.length === 0) {
  console.error(
    `[runtime-vapor] wasm tests passed, but no wasm artifacts were discovered in the test log. See ${path.relative(packageDir, runDir)}`,
  )
  process.exit(1)
}

const llvmProfdataPath = resolveExecutable(rustLlvmBin, 'llvm-profdata')
const llvmCovPath = resolveExecutable(rustLlvmBin, 'llvm-cov')
const mergeResult = run(
  llvmProfdataPath,
  ['merge', '-sparse', ...profrawFiles, '-o', profdataFile],
  { env },
)
if (mergeResult.stdout) {
  process.stdout.write(mergeResult.stdout)
}
if (mergeResult.stderr) {
  process.stderr.write(mergeResult.stderr)
}
if (mergeResult.status !== 0) {
  console.error(
    `[runtime-vapor] Failed to merge profraw into ${path.relative(packageDir, profdataFile)}`,
  )
  process.exit(mergeResult.status ?? 1)
}

const reportArgs = [
  'report',
  ...wasmArtifacts,
  `--instr-profile=${profdataFile}`,
  `--ignore-filename-regex=${reportIgnoreFilenameRegex}`,
]
const reportResult = run(llvmCovPath, reportArgs, { env })
if (reportResult.stdout) {
  process.stdout.write(reportResult.stdout)
  writeFileSync(reportFile, reportResult.stdout)
}
if (reportResult.stderr) {
  process.stderr.write(reportResult.stderr)
}
if (reportResult.status !== 0) {
  console.error(
    `[runtime-vapor] Failed to generate llvm-cov report for ${wasmArtifacts.length} wasm artifact(s).`,
  )
  process.exit(reportResult.status ?? 1)
}

metadata.profdataFile = path.relative(packageDir, profdataFile)
metadata.reportFile = path.relative(packageDir, reportFile)

if (emitHtml) {
  ensureDir(htmlDir)
  const htmlArgs = [
    'show',
    ...wasmArtifacts,
    '--format=html',
    `--output-dir=${htmlDir}`,
    '--show-line-counts-or-regions',
    '--show-directory-coverage',
    `--project-title=rue-runtime-vapor wasm coverage`,
    `--instr-profile=${profdataFile}`,
    `--ignore-filename-regex=${reportIgnoreFilenameRegex}`,
  ]
  const htmlResult = run(llvmCovPath, htmlArgs, { env })
  if (htmlResult.stdout) {
    process.stdout.write(htmlResult.stdout)
  }
  if (htmlResult.stderr) {
    process.stderr.write(htmlResult.stderr)
  }
  if (htmlResult.status !== 0) {
    console.error(
      `[runtime-vapor] Failed to generate llvm-cov HTML report for ${wasmArtifacts.length} wasm artifact(s).`,
    )
    process.exit(htmlResult.status ?? 1)
  }

  metadata.htmlDir = path.relative(packageDir, htmlDir)
}

if (emitLcov) {
  const lcovArgs = [
    'export',
    '--format=lcov',
    ...wasmArtifacts,
    `--instr-profile=${profdataFile}`,
    `--ignore-filename-regex=${reportIgnoreFilenameRegex}`,
  ]
  const lcovResult = run(llvmCovPath, lcovArgs, { env })
  if (lcovResult.stdout) {
    writeFileSync(lcovFile, lcovResult.stdout)
  }
  if (lcovResult.stderr) {
    process.stderr.write(lcovResult.stderr)
  }
  if (lcovResult.status !== 0) {
    console.error(
      `[runtime-vapor] Failed to generate llvm-cov lcov export for ${wasmArtifacts.length} wasm artifact(s).`,
    )
    process.exit(lcovResult.status ?? 1)
  }

  metadata.lcovFile = path.relative(packageDir, lcovFile)
}

writeMetadata(metadata)

console.log(`[runtime-vapor] Captured ${profrawFiles.length} profraw file(s).`)
console.log(
  `[runtime-vapor] Generated llvm-cov report for ${wasmArtifacts.length} wasm artifact(s).`,
)
console.log(`[runtime-vapor] Profdata written to ${path.relative(packageDir, profdataFile)}`)
console.log(`[runtime-vapor] Report written to ${path.relative(packageDir, reportFile)}`)
if (emitHtml) {
  console.log(`[runtime-vapor] HTML report written to ${path.relative(packageDir, htmlDir)}`)
}
if (emitLcov) {
  console.log(`[runtime-vapor] lcov report written to ${path.relative(packageDir, lcovFile)}`)
}
console.log(
  `[runtime-vapor] Latest archive metadata written to ${path.relative(packageDir, latestFile)}`,
)
