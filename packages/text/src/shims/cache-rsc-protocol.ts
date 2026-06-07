import {
  createUseCacheRscProtocolLoader,
  type UseCacheRscProtocol,
} from './cache-rsc-protocol-core.js'
import {
  decodeRuePayloadReadableStream,
  renderRuePayloadToReadableStream,
} from '@rue-js/rsc/core/payload'
import { appBrowserActionProtocol } from '../server/app-rsc-browser-action-protocol.js'
import {
  createActionReferenceSet,
  parseActionArgs,
} from '../server/app-rsc-server-action-protocol.js'

export {
  createUseCacheRscProtocolLoader,
  type UseCacheRscProtocol,
  type UseCacheRscProtocolLoader,
} from './cache-rsc-protocol-core.js'

const rueUseCacheRscProtocol: UseCacheRscProtocol = {
  renderToReadableStream(data, options) {
    return renderRuePayloadToReadableStream(data, options)
  },
  createFromReadableStream(stream, options) {
    return decodeRuePayloadReadableStream(stream, options)
  },
  encodeActionArgs(value, options) {
    return appBrowserActionProtocol.encodeActionArgs(value, options)
  },
  createActionReferenceSet,
  createClientActionReferenceSet() {
    return appBrowserActionProtocol.createActionReferenceSet()
  },
  parseActionArgs,
}

export const useCacheRscProtocolLoader = createUseCacheRscProtocolLoader(async () => {
  return rueUseCacheRscProtocol
})

export async function getUseCacheRscProtocol(): Promise<UseCacheRscProtocol | null> {
  return useCacheRscProtocolLoader.load()
}
