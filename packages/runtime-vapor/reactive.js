import * as reactiveRuntime from './pkg/rue_runtime_vapor.js'

import { installSharedBridge } from './vapor-bridge.js'

installSharedBridge(reactiveRuntime)

export * from './pkg/rue_runtime_vapor.js'
export default reactiveRuntime
