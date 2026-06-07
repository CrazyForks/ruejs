import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const rawRoot = process.argv[2]
const rawPort = process.argv[3]

if (!rawRoot || !rawPort) {
  console.error('Usage: node serve-static.mjs <root-dir> <port>')
  process.exit(1)
}

const rootDir = resolve(rawRoot)
const rootPrefix = rootDir.endsWith(sep) ? rootDir : rootDir + sep
const port = Number.parseInt(rawPort, 10)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: "${rawPort}". Must be an integer between 1 and 65535.`)
  process.exit(1)
}

try {
  const rootStat = await stat(rootDir)
  if (!rootStat.isDirectory()) {
    console.error(`Root path is not a directory: ${rootDir}`)
    process.exit(1)
  }
} catch {
  console.error(`Cannot access root directory: ${rootDir}`)
  console.error('Run `pnpm --dir examples/text-static-export build` first.')
  process.exit(1)
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.rsc': 'text/x-component',
}

async function readStaticFile(filePath) {
  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) return null
    return await readFile(filePath)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
}

function isInsideRoot(filePath) {
  return filePath === rootDir || filePath.startsWith(rootPrefix)
}

const server = createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url ?? '/', 'http://localhost')
    let pathname = decodeURIComponent(parsed.pathname)
    if (pathname === '/.rsc') pathname = '/index.rsc'
    if (pathname.endsWith('/')) pathname += 'index.html'

    let filePath = resolve(join(rootDir, pathname))
    if (!isInsideRoot(filePath)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    let content = await readStaticFile(filePath)
    if (!content && !extname(filePath)) {
      const htmlPath = `${filePath}.html`
      if (isInsideRoot(htmlPath)) {
        content = await readStaticFile(htmlPath)
        if (content) filePath = htmlPath
      }
    }

    if (!content) {
      const notFoundPath = join(rootDir, '404.html')
      const notFoundContent = await readStaticFile(notFoundPath)
      if (notFoundContent) {
        res.writeHead(404, { 'Content-Type': MIME_TYPES['.html'] })
        res.end(notFoundContent)
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
      return
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    })
    res.end(content)
  } catch (error) {
    console.error(`Static request failed for ${req.url}:`, error)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end('Internal Server Error')
    }
  }
})

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the old preview server and try again.`)
  } else {
    console.error('Static export server failed:', error)
  }
  process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Static export server listening on http://127.0.0.1:${port}`)
})
