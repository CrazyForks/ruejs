import { stat } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createStaticPreviewServer } from '@rue-js/server-renderer/static'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staticDir = path.resolve(root, 'dist_static')
const preferredPort = process.env.PORT || 4173
const host = process.env.HOST || '127.0.0.1'

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

await assertStaticDir()

const port = await findAvailablePort(preferredPort, host)
const server = createStaticPreviewServer({
  staticDir,
  contentTypes: {
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  },
  onError(error, request) {
    console.error(`Static preview request failed for ${request.url}:`, error)
  },
})

server.listen(port, host, () => {
  console.log(`Rue static preview: http://${host}:${port}`)
})
