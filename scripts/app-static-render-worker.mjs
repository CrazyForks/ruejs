import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  formatStaticError,
  normalizeStaticRoute,
  renderServerBundleRoute,
  runWithStaticRenderDom,
} from '@rue-js/server-renderer/static'

const [serverBundleFile] = process.argv.slice(2)
const staticDocHtmlByRouteKey = '__RUE_STATIC_DOC_HTML_BY_ROUTE__'
let activeTask = null
let closing = false

if (!serverBundleFile || typeof process.send !== 'function') {
  console.error('Usage: fork scripts/app-static-render-worker.mjs <server-bundle>')
  process.exit(1)
}

const send = message =>
  new Promise((resolve, reject) => {
    if (!process.connected || typeof process.send !== 'function') {
      reject(new Error('Static render worker IPC channel is closed.'))
      return
    }

    process.send(message, error => {
      if (error) reject(error)
      else resolve()
    })
  })

const finishClosing = () => {
  if (!closing || activeTask) return
  if (process.connected) process.disconnect()
}

const renderTask = async message => {
  const { docHtmlFile, id, outputFile, route } = message
  activeTask = id

  try {
    const extraGlobals = {}
    if (docHtmlFile) {
      const docHtml = await readFile(path.resolve(docHtmlFile), 'utf-8')
      extraGlobals[staticDocHtmlByRouteKey] = {
        [normalizeStaticRoute(route)]: docHtml,
      }
    }

    await renderServerBundleRoute({
      serverBundleFile,
      route,
      outputFile,
      extraGlobals,
    })
    await send({ type: 'result', id, ok: true })
  } catch (error) {
    await send({ type: 'result', id, ok: false, error: formatStaticError(error) })
  } finally {
    activeTask = null
    finishClosing()
  }
}

process.on('message', message => {
  if (!message || typeof message !== 'object') return

  if (message.type === 'shutdown') {
    closing = true
    finishClosing()
    return
  }

  if (message.type !== 'render' || closing) return

  if (activeTask) {
    void send({
      type: 'result',
      id: message.id,
      ok: false,
      error: 'Static render worker received a concurrent task.',
    })
    return
  }

  void renderTask(message)
})

process.on('disconnect', () => {
  process.exitCode = 0
})

const serverEntry = await import(pathToFileURL(path.resolve(serverBundleFile)).href)
if (typeof serverEntry.render !== 'function') {
  throw new Error('SSR bundle does not export render(route).')
}
await runWithStaticRenderDom('/', () => undefined)
await send({ type: 'ready' })
