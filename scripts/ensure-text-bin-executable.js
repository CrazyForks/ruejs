#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const cliPath = path.resolve(import.meta.dirname, '../packages/text/dist/cli.js')

if (!fs.existsSync(cliPath)) {
  throw new Error(`Text CLI build output not found: ${cliPath}`)
}

fs.chmodSync(cliPath, 0o755)
