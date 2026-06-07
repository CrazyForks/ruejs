import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, createServer } from 'vite'
import {
  createRueExampleAliases,
  createRueExampleDefine,
  createRueExamplePlugins,
} from '../shared/rue-vite.mjs'
import { findAvailablePort } from '../shared/ports.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(root, 'dist')
const clientDir = path.resolve(distDir, 'client')

const createConfig = ({ ssr = false } = {}) => ({
  root,
  configFile: false,
  publicDir: false,
  appType: ssr ? 'custom' : 'spa',
  plugins: createRueExamplePlugins(),
  resolve: {
    conditions: ssr ? ['development', 'node'] : ['development', 'browser'],
    alias: createRueExampleAliases({ ssr }),
  },
  define: createRueExampleDefine({ dev: false, ssr }),
})

await rm(distDir, { recursive: true, force: true })

await build({
  ...createConfig(),
  build: {
    outDir: clientDir,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(root, 'index.html'),
    },
  },
})

const template = await readFile(path.resolve(clientDir, 'index.html'), 'utf-8')
const hmrPort = await findAvailablePort(process.env.STATIC_RENDER_HMR_PORT || 24678)
const vite = await createServer({
  ...createConfig({ ssr: true }),
  server: {
    hmr: {
      port: hmrPort,
    },
    middlewareMode: true,
  },
})

try {
  const serverEntry = await vite.ssrLoadModule('/src/entry-server.tsx')

  for (const route of serverEntry.staticRoutes) {
    const html = await serverEntry.render(route)
    const file = route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`
    const outputPath = path.resolve(clientDir, file)

    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, template.replace('<!--app-html-->', html))
  }
} finally {
  await vite.close()
}

console.log(`Static Rue demo built at ${path.relative(process.cwd(), clientDir)}`)
