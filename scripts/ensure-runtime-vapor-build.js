import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimeVaporDir = path.resolve(rootDir, 'packages/runtime-vapor')

const { RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS, RUNTIME_TYPESCRIPT_TARGETS } = await import(
  path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs')
)

const typescriptBuildInputs = [
  path.resolve(runtimeVaporDir, 'tsconfig.json'),
  path.resolve(runtimeVaporDir, 'runtime-vapor-env.d.ts'),
  path.resolve(runtimeVaporDir, 'global.d.ts'),
  path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs'),
  ...RUNTIME_TYPESCRIPT_TARGETS.map(target =>
    path.resolve(runtimeVaporDir, target.replace(/\.js$/, '.ts')),
  ),
  ...RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(output =>
    path.resolve(runtimeVaporDir, output.replace(/\.d\.ts$/, '.ts')),
  ),
]

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

const latestTypeScriptInputModifiedTime = typescriptBuildInputs.reduce(
  (latest, targetPath) => Math.max(latest, getLatestModifiedTime(targetPath)),
  0,
)

const generatedTypeScriptArtifacts = RUNTIME_TYPESCRIPT_TARGETS.flatMap(target => [
  path.resolve(runtimeVaporDir, target),
  path.resolve(runtimeVaporDir, target.replace(/\.js$/, '.d.ts')),
])
generatedTypeScriptArtifacts.push(
  ...RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(output => path.resolve(runtimeVaporDir, output)),
)
const generatedTypeScriptIsStale = generatedTypeScriptArtifacts.some(filePath => {
  return (
    !fs.existsSync(filePath) || fs.statSync(filePath).mtimeMs < latestTypeScriptInputModifiedTime
  )
})

if (generatedTypeScriptIsStale) {
  console.log('Building @rue-js/runtime-vapor TypeScript runtime artifacts...')
  const result = spawnSync('pnpm', ['--filter', '@rue-js/runtime-vapor', 'run', 'build-ts'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const requiredArtifacts = [
  {
    filePath: path.resolve(rootDir, 'packages/runtime-vapor/pkg-vapor/rue_runtime_vapor.js'),
    label: 'canonical browser package',
    command: ['--filter', '@rue-js/runtime-vapor', 'run', 'build'],
  },
  {
    filePath: path.resolve(rootDir, 'packages/runtime-vapor/pkg-node/rue_runtime_vapor.js'),
    label: 'node package',
    command: ['--filter', '@rue-js/runtime-vapor', 'run', 'build-node'],
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
