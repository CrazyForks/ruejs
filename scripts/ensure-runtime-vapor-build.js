import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

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
  if (fs.existsSync(artifact.filePath)) {
    continue
  }

  console.log(`Building @rue-js/runtime-vapor ${artifact.label}...`)

  const result = spawnSync('pnpm', artifact.command, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
