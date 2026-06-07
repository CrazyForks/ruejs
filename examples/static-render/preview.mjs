import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findAvailablePort } from '../shared/ports.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.resolve(root, 'dist/client')
const port = await findAvailablePort(process.env.PORT || 4173)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
}

const isInsideClientDir = file => file === clientDir || file.startsWith(`${clientDir}${path.sep}`)

const getExistingFile = async file => {
  if (!isInsideClientDir(file)) {
    return null
  }

  try {
    const info = await stat(file)
    return info.isFile() ? file : null
  } catch {
    return null
  }
}

const resolveRequestFile = async requestUrl => {
  const { pathname } = new URL(requestUrl || '/', 'http://localhost')
  const decodedPathname = decodeURIComponent(pathname)
  const relativePath = decodedPathname.replace(/^\/+/, '')
  const requestedPath = path.resolve(clientDir, relativePath)
  const extension = path.extname(decodedPathname)

  return (
    (await getExistingFile(requestedPath)) ||
    (await getExistingFile(path.join(requestedPath, 'index.html'))) ||
    (!extension ? await getExistingFile(path.join(clientDir, 'index.html')) : null)
  )
}

const server = createServer(async (request, response) => {
  const file = await resolveRequestFile(request.url)

  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('404 not found')
    return
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
  })
  createReadStream(file).pipe(response)
})

server.listen(port, () => {
  console.log(`Rue static render preview: http://localhost:${port}`)
})
