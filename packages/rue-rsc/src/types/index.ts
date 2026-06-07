export interface ImportManifestEntry {
  id: string
  name: string
  chunks: string[]
  async?: boolean
}

export interface BundlerConfig {
  [bundlerId: string]: ImportManifestEntry
}

export type ModuleMap = {
  [id: string]: {
    [exportName: string]: ImportManifestEntry
  }
}

export interface ServerConsumerManifest {
  moduleMap?: ModuleMap
  serverModuleMap?: BundlerConfig
  moduleLoading?: {
    prefix: string
    crossOriign?: string
  }
}

export type CallServerCallback = (id: string, args: unknown[]) => Promise<unknown>

// Best-effort RSC API types.
export interface RenderToReadableStreamOptions {
  debugChannel?: DebugChannel
  environmentName?: string | (() => string)
  filterStackFrame?: (url: string, functionName: string) => boolean
  identifierPrefix?: string
  signal?: AbortSignal
  startTime?: number
  references?: ServerActionReferenceSet
  onError?: (error: unknown) => void
}

export interface CreateFromReadableStreamBrowserOptions {
  callServer?: CallServerCallback
  debugChannel?: DebugChannel
  endTime?: number
  environmentName?: string
  replayConsoleLogs?: boolean
  startTime?: number
  references?: ClientActionReferenceSet
}

export interface CreateFromReadableStreamEdgeOptions {
  debugChannel?: DebugChannel
  endTime?: number
  environmentName?: string
  nonce?: string
  replayConsoleLogs?: boolean
  startTime?: number
  references?: ClientActionReferenceSet
}

export interface ParseActionArgsOptions {
  references?: ServerActionReferenceSet
  arraySizeLimit?: number
}

export interface EncodeActionArgsOptions {
  references?: ClientActionReferenceSet
  signal?: AbortSignal
}

export type EncodeActionArgsFunction = (
  value: unknown[],
  options?: EncodeActionArgsOptions,
) => Promise<string | FormData>
export type ParseActionArgsFunction = (
  body: string | FormData,
  options?: ParseActionArgsOptions,
) => Promise<unknown[]>

type DebugChannel = {
  readable?: ReadableStream<Uint8Array>
  writable?: WritableStream<Uint8Array>
}

export type ServerActionReferenceSet = unknown
export type ClientActionReferenceSet = unknown
