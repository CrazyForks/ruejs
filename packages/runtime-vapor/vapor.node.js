import { createRequire } from 'node:module'

import { buildDefaultExport, installSharedBridge } from './vapor-bridge.js'
import { wrapCreateRue } from './runtime-entry-wrap.js'
import * as sharedRuntime from './reactive.node.js'

const require = createRequire(import.meta.url)
const vaporRuntime = require('./pkg-node/rue_runtime_vapor.js')

installSharedBridge(sharedRuntime)

export const createRue = wrapCreateRue(vaporRuntime.createRue)

export default buildDefaultExport(sharedRuntime, createRue)
