import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const [serverBundleFile, route, outputFile] = process.argv.slice(2)
const docHtmlFile = process.env.APP_STATIC_RENDER_DOC_HTML_FILE
const staticDocHtmlByRouteKey = '__RUE_STATIC_DOC_HTML_BY_ROUTE__'

const formatError = error => {
  if (error instanceof Error) {
    return error.stack || error.message
  }

  return String(error)
}

const normalizeStaticDocRoute = route => {
  const withoutHash = route.split('#')[0]
  const withoutSearch = withoutHash.split('?')[0]
  const normalized = withoutSearch.startsWith('/') ? withoutSearch : `/${withoutSearch}`
  return normalized.length > 1 ? normalized.replace(/\/+$/g, '') : '/'
}

if (!serverBundleFile || !route || !outputFile) {
  console.error(
    'Usage: node scripts/app-static-render-route.mjs <server-bundle> <route> <output-file>',
  )
  process.exit(1)
}

const installStaticRenderDom = route => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    pretendToBeVisual: true,
    url: `http://127.0.0.1${route.startsWith('/') ? route : `/${route}`}`,
  })
  const { window } = dom

  const defineGlobal = (key, value) => {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      enumerable: true,
      writable: true,
    })
  }

  for (const [key, value] of Object.entries({
    window,
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
    getComputedStyle: window.getComputedStyle.bind(window),
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  })) {
    defineGlobal(key, value)
  }

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = query => ({
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
  }
  defineGlobal('matchMedia', window.matchMedia.bind(window))

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

  const canvasProto = window.HTMLCanvasElement?.prototype
  if (canvasProto) {
    canvasProto.getContext = () => ({
      beginPath() {},
      clearRect() {},
      closePath() {},
      drawImage() {},
      fill() {},
      fillRect() {},
      fillText() {},
      measureText: text => ({ width: String(text).length * 8 }),
      moveTo() {},
      lineTo() {},
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
}

try {
  installStaticRenderDom(route)

  const serverEntry = await import(`${pathToFileURL(serverBundleFile).href}?route=${Date.now()}`)
  if (typeof serverEntry.render !== 'function') {
    throw new Error('SSR bundle does not export render(url).')
  }

  if (docHtmlFile) {
    const docHtml = await readFile(path.resolve(docHtmlFile), 'utf-8')
    Object.defineProperty(globalThis, staticDocHtmlByRouteKey, {
      value: {
        [normalizeStaticDocRoute(route)]: docHtml,
      },
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }

  const html = await serverEntry.render(route)
  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, html)
} catch (error) {
  console.error(formatError(error))
  process.exit(1)
}
