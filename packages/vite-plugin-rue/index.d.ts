import type { Plugin } from 'vite'

export interface RueTransformExecutorPayload {
  code: string
  id: string
  pluginPath: string
  timeoutMs: number
}

export interface RueVitePluginOptions {
  include?: string[]
  exclude?: string[]
  debug?: boolean
  transformTimeoutMs?: number
  transformExecutor?: (payload: RueTransformExecutorPayload) => Promise<string> | string
}

export default function VitePluginRue(options?: RueVitePluginOptions): Plugin
