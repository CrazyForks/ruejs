import swc from '@swc/core'
import { parentPort, workerData } from 'node:worker_threads'

const createSwcTransformOptions = ({ pluginPath, isProduction }) => ({
  filename: 'rue.tsx',
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    target: 'es2020',
    transform: {
      react: {
        runtime: 'automatic',
        importSource: '@rue-js',
        development: !isProduction,
        throwIfNamespace: false,
      },
    },
    experimental: {
      plugins: [[pluginPath, {}]],
    },
  },
  minify: isProduction,
})

const serializeError = error => ({
  name: error?.name || 'Error',
  message: error?.message || String(error),
  stack: error?.stack,
})

try {
  const { code, pluginPath, isProduction } = workerData
  const out = swc.transformSync(code, createSwcTransformOptions({ pluginPath, isProduction }))
  parentPort?.postMessage({ code: out.code })
} catch (error) {
  parentPort?.postMessage({ error: serializeError(error) })
}
