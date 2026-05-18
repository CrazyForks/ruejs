import * as sharedRuntime from './reactive.js'
import * as vaporRuntime from './pkg/rue_runtime_vapor.js'

import { buildDefaultExport, installSharedBridge } from './vapor-bridge.js'
import { wrapCreateRue } from './runtime-entry-wrap.js'

installSharedBridge(sharedRuntime)

export const createRue = wrapCreateRue(vaporRuntime.createRue)

export default buildDefaultExport(sharedRuntime, createRue)
