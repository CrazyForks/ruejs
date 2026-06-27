import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const [outDirArg, route, outputFile] = process.argv.slice(2)

const formatError = error => {
  if (error instanceof Error) {
    return error.stack || error.message
  }

  return String(error)
}

if (!outDirArg || !route || !outputFile) {
  console.error('Usage: node scripts/app-static-snapshot-route.mjs <out-dir> <route> <output-file>')
  process.exit(1)
}

const outDir = path.resolve(outDirArg)
const clientTemplateFile = process.env.APP_STATIC_CLIENT_TEMPLATE_FILE
const snapshotSettleMs = Number(process.env.APP_STATIC_SNAPSHOT_SETTLE_MS || 750)
const snapshotWaitMs = Number(process.env.APP_STATIC_SNAPSHOT_WAIT_MS || 9000)
const nativeFetch = globalThis.fetch
const NativeHeaders = globalThis.Headers
const NativeResponse = globalThis.Response

const defineGlobal = (key, value) => {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  })
}

const createMediaQueryList = query => ({
  matches: false,
  media: String(query),
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() {
    return false
  },
})

const installCanvasShim = window => {
  const canvasProto = window.HTMLCanvasElement?.prototype
  if (!canvasProto) return

  canvasProto.getContext = () => ({
    beginPath() {},
    clearRect() {},
    closePath() {},
    drawImage() {},
    fill() {},
    fillRect() {},
    fillText() {},
    lineTo() {},
    measureText: text => ({ width: String(text).length * 8 }),
    moveTo() {},
    quadraticCurveTo() {},
    rect() {},
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    stroke() {},
    translate() {},
    set fillStyle(_value) {},
    set font(_value) {},
    set globalAlpha(_value) {},
    set lineWidth(_value) {},
    set strokeStyle(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {},
  })
  canvasProto.toDataURL = () => 'data:image/png;base64,'
}

const findClientEntry = template => {
  const scriptRe = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
  const match = scriptRe.exec(template)
  if (!match) {
    throw new Error('Could not find the client module entry in dist_static/index.html.')
  }

  return match[1]
}

const assetContentType = file => {
  if (file.endsWith('.wasm')) return 'application/wasm'
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg'
  if (file.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

const resolveOutputFileFromUrl = (input, baseUrl) => {
  const rawUrl = typeof input === 'string' ? input : input?.url
  if (!rawUrl) return null

  const parsed = new URL(rawUrl, baseUrl)

  if (parsed.protocol === 'file:') {
    const file = fileURLToPath(parsed)
    const relative = path.relative(outDir, file)
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? file : null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }

  const localHost = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
  if (!localHost || !parsed.pathname.startsWith('/assets/')) {
    return null
  }

  return path.join(outDir, decodeURIComponent(parsed.pathname.slice(1)))
}

const installFetchShim = window => {
  const fileFetch = async (input, init) => {
    const file = resolveOutputFileFromUrl(input, window.location.href)
    if (file) {
      const body = await readFile(file)
      return new NativeResponse(body, {
        headers: new NativeHeaders({
          'content-type': assetContentType(file),
        }),
      })
    }

    return nativeFetch(input, init)
  }

  defineGlobal('fetch', fileFetch)
  window.fetch = fileFetch
}

const installDom = template => {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  const dom = new JSDOM(template, {
    pretendToBeVisual: true,
    url: `http://127.0.0.1${normalizedRoute}`,
  })
  const { window } = dom

  for (const [key, value] of Object.entries({
    window,
    self: window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    history: window.history,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    HTMLCanvasElement: window.HTMLCanvasElement,
    SVGElement: window.SVGElement,
    Text: window.Text,
    Comment: window.Comment,
    DocumentFragment: window.DocumentFragment,
    CustomEvent: window.CustomEvent,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    FocusEvent: window.FocusEvent,
    InputEvent: window.InputEvent,
    DOMRect: window.DOMRect,
    MutationObserver: window.MutationObserver,
    URL: window.URL,
    URLSearchParams: window.URLSearchParams,
    Blob: window.Blob,
    File: window.File,
    FormData: window.FormData,
    Headers: window.Headers,
    Request: window.Request,
    Response: window.Response,
    AbortController: window.AbortController,
    atob: window.atob.bind(window),
    btoa: window.btoa.bind(window),
    getComputedStyle: window.getComputedStyle.bind(window),
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  })) {
    if (value !== undefined) {
      defineGlobal(key, value)
    }
  }

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = createMediaQueryList
  }
  defineGlobal('matchMedia', window.matchMedia.bind(window))

  if (typeof window.requestIdleCallback !== 'function') {
    window.requestIdleCallback = callback =>
      window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 1)
    window.cancelIdleCallback = id => window.clearTimeout(id)
  }
  defineGlobal('requestIdleCallback', window.requestIdleCallback.bind(window))
  defineGlobal('cancelIdleCallback', window.cancelIdleCallback.bind(window))

  if (typeof globalThis.ResizeObserver !== 'function') {
    defineGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  }

  if (typeof globalThis.IntersectionObserver !== 'function') {
    defineGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      },
    )
  }

  installCanvasShim(window)
  installFetchShim(window)

  return window
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const readClientTemplate = () => {
  return readFile(
    clientTemplateFile ? path.resolve(clientTemplateFile) : path.resolve(outDir, 'index.html'),
    'utf-8',
  )
}

const waitForAppHtml = async window => {
  const start = Date.now()
  let firstReadyAt = 0

  while (Date.now() - start < snapshotWaitMs) {
    await delay(50)
    await Promise.resolve()

    const app = window.document.querySelector('#app')
    const html = app?.innerHTML?.trim() || ''
    const hasContent = html && (app.children.length > 0 || app.textContent.trim())

    if (hasContent) {
      if (!firstReadyAt) {
        firstReadyAt = Date.now()
      }

      if (Date.now() - firstReadyAt >= snapshotSettleMs) {
        return html
      }
    }
  }

  throw new Error(`Static snapshot did not render #app content within ${snapshotWaitMs}ms.`)
}

try {
  const template = await readClientTemplate()
  const clientEntry = findClientEntry(template)
  const window = installDom(template)
  const clientEntryFile = path.resolve(outDir, clientEntry.replace(/^\/+/, ''))

  await import(`${pathToFileURL(clientEntryFile).href}?snapshot=${Date.now()}`)

  const appHtml = await waitForAppHtml(window)
  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, appHtml)
  process.exit(0)
} catch (error) {
  console.error(formatError(error))
  process.exit(1)
}
