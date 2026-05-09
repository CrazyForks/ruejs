// @ts-check
// package watch builds now share the same Vite 8 pipeline as production builds.

import { parseArgs } from 'node:util'
import { watchPackageTarget } from './vite-package-builder.js'

const {
  values: { format: rawFormat, prod, inline: inlineDeps },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'global',
    },
    prod: {
      type: 'boolean',
      short: 'p',
      default: false,
    },
    inline: {
      type: 'boolean',
      short: 'i',
      default: false,
    },
  },
})

const format = rawFormat || 'global'
const targets = positionals.length ? positionals : ['rue']

for (const target of targets) {
  await watchPackageTarget(target, {
    format,
    prod,
    inlineDeps,
  })
}
