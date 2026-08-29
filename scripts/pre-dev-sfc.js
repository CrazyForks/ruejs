// @ts-check
// copy from vuejs/core
// https://github.com/vuejs/core/blob/main/scripts/pre-dev-sfc.js
import fs from 'node:fs'

const packagesToCheck = ['shared']

let allFilesPresent = true

for (const pkg of packagesToCheck) {
  if (!fs.existsSync(new URL(`../packages/${pkg}/dist/${pkg}.esm-bundler.js`, import.meta.url))) {
    allFilesPresent = false
    break
  }
}

if (!allFilesPresent) {
  process.exit(1)
}
