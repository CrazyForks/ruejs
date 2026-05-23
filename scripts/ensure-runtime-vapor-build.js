import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimeVaporDir = path.resolve(rootDir, 'packages/runtime-vapor')

const buildInputs = [
  path.resolve(runtimeVaporDir, 'Cargo.toml'),
  path.resolve(runtimeVaporDir, 'Cargo.lock'),
  path.resolve(runtimeVaporDir, 'package.json'),
  path.resolve(runtimeVaporDir, 'src'),
  path.resolve(runtimeVaporDir, 'scripts/run-wasm-pack.mjs'),
]

const getLatestModifiedTime = targetPath => {
  if (!fs.existsSync(targetPath)) {
    return 0
  }

  const stat = fs.statSync(targetPath)
  if (!stat.isDirectory()) {
    return stat.mtimeMs
  }

  let latestModifiedTime = stat.mtimeMs
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    latestModifiedTime = Math.max(
      latestModifiedTime,
      getLatestModifiedTime(path.join(targetPath, entry.name)),
    )
  }

  return latestModifiedTime
}

const latestInputModifiedTime = buildInputs.reduce(
  (latest, targetPath) => Math.max(latest, getLatestModifiedTime(targetPath)),
  0,
)

const requiredArtifacts = [
  {
    filePath: path.resolve(rootDir, 'packages/runtime-vapor/pkg/rue_runtime_vapor.js'),
    label: 'bundler package',
    command: ['--filter', '@rue-js/runtime-vapor', 'run', 'build'],
  },
  {
    filePath: path.resolve(rootDir, 'packages/runtime-vapor/pkg-node/rue_runtime_vapor.js'),
    label: 'node package',
    command: ['--filter', '@rue-js/runtime-vapor', 'run', 'build-node'],
  },
  {
    filePath: path.resolve(
      rootDir,
      'packages/runtime-vapor/pkg-node-reactive/rue_runtime_vapor.js',
    ),
    label: 'node reactive package',
    command: ['--filter', '@rue-js/runtime-vapor', 'run', 'build-node-reactive'],
  },
  {
    filePath: path.resolve(rootDir, 'packages/runtime-vapor/pkg-node-vapor/rue_runtime_vapor.js'),
    label: 'node vapor package',
    command: ['--filter', '@rue-js/runtime-vapor', 'run', 'build-node-vapor'],
  },
]

for (const artifact of requiredArtifacts) {
  const artifactExists = fs.existsSync(artifact.filePath)
  const artifactModifiedTime = artifactExists ? fs.statSync(artifact.filePath).mtimeMs : 0
  const artifactIsStale = artifactExists && artifactModifiedTime < latestInputModifiedTime

  if (artifactExists && !artifactIsStale) {
    continue
  }

  const actionLabel = artifactExists ? 'Rebuilding' : 'Building'
  const reasonLabel = artifactExists ? 'sources are newer than the artifact' : 'artifact missing'

  console.log(`${actionLabel} @rue-js/runtime-vapor ${artifact.label} because ${reasonLabel}...`)

  const result = spawnSync('pnpm', artifact.command, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
