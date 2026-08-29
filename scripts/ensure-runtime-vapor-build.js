import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimeVaporDir = path.resolve(rootDir, 'packages/runtime-vapor')
const runtimeVaporSourceDir = path.resolve(runtimeVaporDir, 'src')
const runtimeVaporDistDir = path.resolve(runtimeVaporDir, 'dist')

const { RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS, RUNTIME_TYPESCRIPT_TARGETS } = await import(
  path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs')
)

const typescriptBuildInputs = [
  path.resolve(runtimeVaporDir, 'package.json'),
  path.resolve(runtimeVaporDir, 'tsconfig.json'),
  path.resolve(runtimeVaporSourceDir, 'global.d.ts'),
  path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs'),
  ...RUNTIME_TYPESCRIPT_TARGETS.map(target =>
    path.resolve(runtimeVaporSourceDir, target.replace(/\.js$/, '.ts')),
  ),
  ...RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(output =>
    path.resolve(runtimeVaporSourceDir, output.replace(/\.d\.ts$/, '.ts')),
  ),
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

const latestTypeScriptInputModifiedTime = typescriptBuildInputs.reduce(
  (latest, targetPath) => Math.max(latest, getLatestModifiedTime(targetPath)),
  0,
)

const generatedTypeScriptArtifacts = RUNTIME_TYPESCRIPT_TARGETS.flatMap(target => [
  path.resolve(runtimeVaporDistDir, target),
  path.resolve(runtimeVaporDistDir, target.replace(/\.js$/, '.d.ts')),
])
generatedTypeScriptArtifacts.push(path.resolve(runtimeVaporDistDir, 'global.d.ts'))
generatedTypeScriptArtifacts.push(
  ...RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(output =>
    path.resolve(runtimeVaporDistDir, output),
  ),
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
