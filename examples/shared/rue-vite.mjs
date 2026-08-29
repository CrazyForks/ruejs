import path from 'node:path'
import { fileURLToPath } from 'node:url'
import VitePluginRue from '../../packages/vite-plugin-rue/index.mjs'

const sharedDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(sharedDir, '../..')
const vaporRuntime = path.resolve(repoRoot, 'packages/runtime-vapor')

export const createRueExampleAliases = () => ({
  '@rue-js/rue': path.resolve(repoRoot, 'packages/rue/src'),
  '@rue-js/router': path.resolve(repoRoot, 'packages/router/src'),
  '@rue-js/runtime': path.resolve(repoRoot, 'packages/runtime/src'),
  '@rue-js/server-renderer': path.resolve(repoRoot, 'packages/server-renderer/src'),
  '@rue-js/shared': path.resolve(repoRoot, 'packages/shared/src'),
  '@rue-js/jsx-runtime': path.resolve(repoRoot, 'packages/jsx-runtime/src'),
  '@rue-js/jsx-dev-runtime': path.resolve(repoRoot, 'packages/jsx-dev-runtime/src'),
})

const resolveRuntimeVaporEntry = (id, ssr) => {
  if (id === '@rue-js/runtime-vapor/vapor') {
    return path.resolve(vaporRuntime, ssr ? 'vapor.node.js' : 'vapor.js')
  }
  if (id === '@rue-js/runtime-vapor/reactive') {
    return path.resolve(vaporRuntime, ssr ? 'reactive.node.js' : 'reactive.js')
  }
  if (id === '@rue-js/runtime-vapor') {
    return path.resolve(vaporRuntime, ssr ? 'index.node.js' : 'index.js')
  }
  return null
}

const createRueRuntimeVaporResolvePlugin = () => ({
  name: 'rue-example-runtime-vapor-resolve',
  enforce: 'pre',
  resolveId(id, _importer, options) {
    return resolveRuntimeVaporEntry(id, options?.ssr === true)
  },
})

export const createRueExampleDefine = ({ dev = true, ssr = false } = {}) => ({
  __DEV__: String(dev),
  __TEST__: 'false',
  __VERSION__: JSON.stringify('example'),
  __BROWSER__: String(!ssr),
  __GLOBAL__: 'false',
  __ESM_BUNDLER__: 'true',
  __ESM_BROWSER__: 'false',
  __CJS__: 'false',
  __SSR__: String(ssr),
  __COMPAT__: 'false',
  __FEATURE_OPTIONS_API__: 'true',
  __FEATURE_SUSPENSE__: 'true',
  __FEATURE_PROD_DEVTOOLS__: 'false',
  __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
})

export const createRueExamplePlugins = ({ transformTimeoutMs = 60000 } = {}) => [
  createRueRuntimeVaporResolvePlugin(),
  VitePluginRue({ transformTimeoutMs }),
]
