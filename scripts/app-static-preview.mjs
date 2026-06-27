import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { stat } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staticDir = path.resolve(root, 'dist_static')
const staticDirPrefix = staticDir.endsWith(path.sep) ? staticDir : `${staticDir}${path.sep}`
const preferredPort = process.env.PORT || 4173
const host = process.env.HOST || '127.0.0.1'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const findAvailablePort = async (preferred, host) => {
  let port = Number(preferred)

  if (!Number.isFinite(port) || port <= 0) {
    port = 0
  }

  while (true) {
    const available = await new Promise(resolve => {
      const probe = net.createServer()

      probe.once('error', () => {
        resolve(false)
      })

      probe.once('listening', () => {
        probe.close(() => {
          resolve(true)
        })
      })

      probe.listen(port, host)
    })

    if (available) {
      return port
    }

    port += 1
  }
}

const isInsideStaticDir = file => {
  return file === staticDir || file.startsWith(staticDirPrefix)
}

const getExistingFile = async file => {
  if (!isInsideStaticDir(file)) {
    return null
  }

  try {
    const info = await stat(file)
    return info.isFile() ? file : null
  } catch {
    return null
  }
}

const assertStaticDir = async () => {
  try {
    const info = await stat(staticDir)
    if (info.isDirectory()) {
      return
    }
  } catch {}

  console.error(`Cannot find ${path.relative(process.cwd(), staticDir)}.`)
  console.error('Run `npm run app-static-build` first.')
  process.exit(1)
}

const resolveRequestFile = async requestUrl => {
  const { pathname } = new URL(requestUrl || '/', `http://${host}`)
  const decodedPathname = decodeURIComponent(pathname)
  const relativePath = decodedPathname.replace(/^\/+/, '')
  const requestedPath = path.resolve(staticDir, relativePath)
  const extension = path.extname(decodedPathname)

  return (
    (await getExistingFile(requestedPath)) ||
    (await getExistingFile(path.join(requestedPath, 'index.html'))) ||
    (!extension ? await getExistingFile(path.join(staticDir, 'index.html')) : null)
  )
}

await assertStaticDir()

const port = await findAvailablePort(preferredPort, host)
const server = createServer(async (request, response) => {
  try {
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
  } catch (error) {
    console.error(`Static preview request failed for ${request.url}:`, error)
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('internal server error')
    }
  }
})

server.listen(port, host, () => {
  console.log(`Rue static preview: http://${host}:${port}`)
})
