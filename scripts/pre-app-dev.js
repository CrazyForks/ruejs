// @ts-check

import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const runtimeVaporRoot = path.resolve(__dirname, '../packages/runtime-vapor')
const runtimeVaporBuildInputs = ['src', 'Cargo.toml', 'Cargo.lock']

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

const requiredBuilds = [
  {
    file: 'pkg/rue_runtime_vapor_bg.wasm',
    script: 'build',
    outputs: [
      'pkg/rue_runtime_vapor.js',
      'pkg/rue_runtime_vapor_bg.js',
      'pkg/rue_runtime_vapor_bg.wasm',
    ],
  },
]

const missingOrStaleBuilds = requiredBuilds.filter(({ outputs }) => {
  const resolvedOutputs = outputs.map(file => path.resolve(runtimeVaporRoot, file))
  if (resolvedOutputs.some(file => !fs.existsSync(file))) {
    return true
  }

  const oldestOutputMtimeMs = resolvedOutputs.reduce((oldestMtimeMs, file) => {
    return Math.min(oldestMtimeMs, fs.statSync(file).mtimeMs)
  }, Number.POSITIVE_INFINITY)

  return oldestOutputMtimeMs < runtimeVaporInputMtimeMs
})

if (!missingOrStaleBuilds.length) {
  process.exit(0)
}

const packageManager =
  process.env.npm_execpath || (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')

for (const { script, file, outputs } of missingOrStaleBuilds) {
  const resolvedOutputs = outputs.map(output => path.resolve(runtimeVaporRoot, output))
  const isMissing = resolvedOutputs.some(output => !fs.existsSync(output))
  const reason = isMissing ? 'Missing' : 'Stale'

  console.log(`[preapp] ${reason} ${file}, running @rue-js/runtime-vapor:${script}`)

  const result = spawnSync(packageManager, ['run', script], {
    cwd: runtimeVaporRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
