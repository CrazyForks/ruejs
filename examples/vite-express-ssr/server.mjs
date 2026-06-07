import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer as createViteServer } from 'vite'
import {
  createRueExampleAliases,
  createRueExampleDefine,
  createRueExamplePlugins,
} from '../shared/rue-vite.mjs'
import { findAvailablePort } from '../shared/ports.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const port = await findAvailablePort(process.env.PORT || 5174)
const hmrPort = await findAvailablePort(process.env.HMR_PORT || 24678)

const app = express()
const vite = await createViteServer({
  root,
  server: {
    hmr: {
      port: hmrPort,
    },
    middlewareMode: true,
  },
  appType: 'custom',
  plugins: createRueExamplePlugins(),
  resolve: {
    conditions: ['development', 'node'],
    alias: createRueExampleAliases({ ssr: true }),
  },
  define: createRueExampleDefine({ dev: true, ssr: true }),
})

app.use(vite.middlewares)

app.use(async (req, res, next) => {
  try {
    const url = req.originalUrl
    const templatePath = path.resolve(root, 'index.html')
    const template = await vite.transformIndexHtml(url, await fs.readFile(templatePath, 'utf-8'))
    const { render } = await vite.ssrLoadModule('/src/entry-server.tsx')
    const { html, status } = await render(url)

    res
      .status(status)
      .set({ 'Content-Type': 'text/html' })
      .end(template.replace('<!--app-html-->', html))
  } catch (error) {
    vite.ssrFixStacktrace(error)
    next(error)
  }
})

app.listen(port, () => {
  console.log(`Rue Vite Express SSR demo: http://localhost:${port}`)
  console.log(`Rue Vite Express SSR HMR: ws://localhost:${hmrPort}`)
})
