import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStaticPreviewServer } from '@rue-js/server-renderer/static'
import { findAvailablePort } from '../shared/ports.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.resolve(root, 'dist/client')
const port = await findAvailablePort(process.env.PORT || 4173)

const server = createStaticPreviewServer({
  staticDir: clientDir,
  contentTypes: {
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  },
  onError(error, request) {
    console.error(`Static render preview failed for ${request.url}:`, error)
  },
})

server.listen(port, () => {
  console.log(`Rue static render preview: http://localhost:${port}`)
})
