#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeVaporRoot = path.join(rootDir, 'packages/runtime-vapor')
const textRuntimeVaporDist = path.join(rootDir, 'packages/text/dist/runtime-vapor')
const runtimeVaporPackageDirs = ['pkg-vapor', 'pkg-node']

await Promise.all(
  runtimeVaporPackageDirs.map(async dir => {
    await fs.cp(path.join(runtimeVaporRoot, dir), path.join(textRuntimeVaporDist, dir), {
      force: true,
      recursive: true,
    })
  }),
)
