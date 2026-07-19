import fs from 'node:fs/promises'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer as createViteServer } from 'vite'
import { createServerIslandHandler } from '@rue-js/server-renderer/server-island'

const root = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 5176)

const readKey = () => {
  const encoded = process.env.RUE_SERVER_ISLAND_KEY
  if (!encoded) {
    console.warn(
      'Using an ephemeral development server-island key; set RUE_SERVER_ISLAND_KEY in production.',
    )
    return new Uint8Array(randomBytes(32))
  }
  const key = new Uint8Array(Buffer.from(encoded, 'base64url'))
  if (key.byteLength !== 32)
    throw new Error('RUE_SERVER_ISLAND_KEY must decode to exactly 32 bytes.')
  return key
}

const key = readKey()
const vite = await createViteServer({ root, appType: 'custom', server: { middlewareMode: true } })

const islandHandler = createServerIslandHandler({
  key,
  async resolve(id, _request) {
    const registry = await vite.ssrLoadModule('virtual:rue-server-island-registry')
    const module = await registry.resolveRueServerIslandModule(id)
    return module.default ?? null
  },
  async render({ component, props, request }) {
    const entry = await vite.ssrLoadModule('/src/entry-server.tsx')
    return entry.renderServerIsland(component, props, request)
  },
})

const toRequest = async req => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`)
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item))
    else if (value !== undefined) headers.set(name, value)
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
  return new Request(url, { method: req.method, headers, body })
}

const sendResponse = async (res, response) => {
  res.statusCode = response.status
  response.headers.forEach((value, name) => res.setHeader(name, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

const server = http.createServer((req, res) => {
  void (async () => {
    try {
      const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname
      if (pathname === '/_rue/server-island') {
        await sendResponse(res, await islandHandler(await toRequest(req)))
        return
      }

      vite.middlewares(req, res, async () => {
        try {
          const template = await vite.transformIndexHtml(
            req.url || '/',
            await fs.readFile(path.join(root, 'index.html'), 'utf8'),
          )
          const entry = await vite.ssrLoadModule('/src/entry-server.tsx')
          const appHtml = await entry.renderPage(key)
          res.statusCode = 200
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.setHeader('set-cookie', 'session=demo; Path=/; HttpOnly; SameSite=Lax')
          res.end(template.replace('<!--app-html-->', appHtml))
        } catch (error) {
          vite.ssrFixStacktrace(error)
          console.error(error)
          if (!res.headersSent) res.statusCode = 500
          res.end('Internal server error')
        }
      })
    } catch (error) {
      console.error(error)
      if (!res.headersSent) res.statusCode = 500
      res.end('Internal server error')
    }
  })()
})

server.listen(port, () => {
  console.log(`Rue server islands example: http://localhost:${port}`)
})
