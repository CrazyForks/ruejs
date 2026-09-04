#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

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

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const artifactNeedsBuild = (artifactPaths, inputPaths) => {
  const latestInputModifiedTime = inputPaths.reduce(
    (latest, targetPath) => Math.max(latest, getLatestModifiedTime(targetPath)),
    0,
  )

  return artifactPaths.some(artifactPath => {
    if (!fs.existsSync(artifactPath)) {
      return true
    }

    return fs.statSync(artifactPath).mtimeMs < latestInputModifiedTime
  })
}

const corePackageInputs = [
  'scripts/build.js',
  'scripts/vite-package-builder.js',
  'packages/shared/package.json',
  'packages/shared/src',
  'packages/runtime/package.json',
  'packages/runtime/src',
  'packages/server-renderer/package.json',
  'packages/server-renderer/src',
  'packages/rue/package.json',
  'packages/rue/src',
].map(targetPath => path.resolve(rootDir, targetPath))

const corePackageArtifacts = [
  'packages/shared/dist/shared.esm-bundler.js',
  'packages/runtime/dist/runtime.esm-bundler.js',
  'packages/runtime/dist/runtime.esm-browser.js',
  'packages/server-renderer/dist/server-renderer.esm-bundler.js',
  'packages/rue/dist/rue.esm-bundler.js',
  'packages/rue/dist/rue.runtime.esm-browser.js',
  'packages/rue/dist/rue.server-renderer.esm-bundler.js',
].map(targetPath => path.resolve(rootDir, targetPath))

if (artifactNeedsBuild(corePackageArtifacts, corePackageInputs)) {
  console.log('Building Rue workspace packages required by @rue-js/text tests...')
  run('node', [
    'scripts/build.js',
    '^shared$',
    '^runtime$',
    '^server-renderer$',
    '^rue$',
    '--formats',
    'esm-bundler,esm-browser,esm-browser-runtime',
  ])
}

const rscInputs = [
  'packages/rue-rsc/package.json',
  'packages/rue-rsc/tsdown.config.ts',
  'packages/rue-rsc/src',
].map(targetPath => path.resolve(rootDir, targetPath))

const rscArtifacts = [
  'packages/rue-rsc/dist/index.js',
  'packages/rue-rsc/dist/plugin.js',
  'packages/rue-rsc/dist/browser.js',
  'packages/rue-rsc/dist/ssr.js',
  'packages/rue-rsc/dist/rsc.js',
  'packages/rue-rsc/dist/core/payload.js',
  'packages/rue-rsc/dist/transforms/index.js',
].map(targetPath => path.resolve(rootDir, targetPath))

if (artifactNeedsBuild(rscArtifacts, rscInputs)) {
  console.log('Building @rue-js/rsc required by @rue-js/text tests...')
  run('pnpm', ['--filter', '@rue-js/rsc', 'run', 'build'])
}
