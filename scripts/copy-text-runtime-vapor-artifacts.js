#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeVaporRoot = path.join(rootDir, 'packages/runtime-vapor')
const textRuntimeVaporDist = path.join(rootDir, 'packages/text/dist/runtime-vapor')
const { RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS, RUNTIME_TYPESCRIPT_TARGETS } = await import(
  path.join(runtimeVaporRoot, 'scripts/emit-typescript-runtime.mjs')
)

const artifactFiles = [
  'package.json',
  'dist/global.d.ts',
  ...RUNTIME_TYPESCRIPT_TARGETS.flatMap(target => [
    `dist/${target}`,
    `dist/${target.replace(/\.js$/, '.d.ts')}`,
  ]),
  ...RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(output => `dist/${output}`),
]

await fs.rm(textRuntimeVaporDist, { force: true, recursive: true })
await Promise.all(
  [...new Set(artifactFiles)].map(async file => {
    const destination = path.join(textRuntimeVaporDist, file)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(path.join(runtimeVaporRoot, file), destination)
  }),
)
