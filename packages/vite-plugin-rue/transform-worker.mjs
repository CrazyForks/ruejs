import swc from '@swc/core'
import { parentPort, workerData } from 'node:worker_threads'

const createSwcTransformOptions = ({ pluginPath, isProduction, target = 'client' }) => ({
  filename: 'rue.tsx',
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    target: 'es2020',
    experimental: {
      plugins: [[pluginPath, { target }]],
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
  const { code, pluginPath, isProduction, target } = workerData
  const out = swc.transformSync(
    code,
    createSwcTransformOptions({
      pluginPath,
      isProduction,
      target,
    }),
  )
  parentPort?.postMessage({ code: out.code })
} catch (error) {
  parentPort?.postMessage({ error: serializeError(error) })
}
