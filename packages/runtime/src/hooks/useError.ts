/*
错误处理 Hook 概述
- 能力目标：统一错误捕获与呈现（控制台 + 页面覆盖层），并提供主动触发接口。
- console：将错误堆栈以美化样式输出到控制台，突出显示标题与堆栈信息。
- overlay：在页面上显示可关闭的错误覆盖层（遮罩 + 对话框），开发阶段便于快速定位。
- emit：主动调用 Rue 框架的 handleError，支持传入实例上下文以便精确定位。
*/
import rue, { onError } from '../rue'
import { setInnerHTML } from '../dom'

const RUE_ERROR_OVERLAY_ID = 'rue-error-overlay'

type NormalizedErrorDetails = {
  message: string
  stack: string
}

type ErrorShape = {
  message?: unknown
  stack?: unknown
  name?: unknown
  cause?: unknown
}

type BrowserResourceTarget = EventTarget & {
  tagName?: string
  src?: string
  href?: string
  currentSrc?: string
  rel?: string
}

let bridgedWindow: Window | null = null
const bridgedBrowserErrors = new WeakSet<object>()

const escapeHtml = (value: string) =>
  value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&#39;')

const getErrorShape = (error: unknown): ErrorShape | null =>
  error && typeof error === 'object' ? (error as ErrorShape) : null

const getErrorName = (error: unknown) => {
  if (error instanceof Error && error.name) {
    return error.name
  }

  const shape = getErrorShape(error)
  return typeof shape?.name === 'string' ? shape.name : ''
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  const shape = getErrorShape(error)
  if (typeof shape?.message === 'string') {
    return shape.message
  }

  return String(error)
}

const getErrorStack = (error: unknown) => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return error.stack
  }

  const shape = getErrorShape(error)
  return typeof shape?.stack === 'string' ? shape.stack : ''
}

const isRueWasmTrapDiagnostic = (error: unknown) => getErrorName(error) === 'RueWasmTrapError'

const isProbablyWasmUnreachableTrap = (error: unknown) => {
  if (isRueWasmTrapDiagnostic(error)) {
    return false
  }

  const name = getErrorName(error)
  const message = getErrorMessage(error)
  if (!/unreachable/i.test(message)) {
    return false
  }

  return (
    name === 'RuntimeError' ||
    name === 'WebAssembly.RuntimeError' ||
    /RuntimeError:\s*unreachable/i.test(message) ||
    /^unreachable$/i.test(message.trim())
  )
}

const createRueWasmTrapDiagnostic = (error: unknown) => {
  const originalName = getErrorName(error)
  const originalMessage = getErrorMessage(error)
  const originalStack = getErrorStack(error)
  const originalTrap = [originalName, originalMessage].filter(Boolean).join(': ')
  const diagnostic = new Error(
    'Rue Vapor/Wasm trapped with "unreachable". This usually means compiled render code mutated a props-derived or computed object during render. Fix the component by assembling a fresh object instead of deleting or rewriting fields on an object built from props + ...rest. If this came from pretransformed rue-design source, add /* RUE_VAPOR_TRANSFORMED */ at the top of the component file so Vite does not Vapor-transform it again.' +
      (originalTrap ? ` Original trap: ${originalTrap}.` : ''),
  )

  diagnostic.name = 'RueWasmTrapError'

  if (originalStack) {
    diagnostic.stack = `${diagnostic.name}: ${diagnostic.message}\nCaused by: ${originalStack}`
  }

  ;(diagnostic as Error & { cause?: unknown }).cause = error
  return diagnostic
}

const normalizeRueReportableError = (error: unknown) =>
  isProbablyWasmUnreachableTrap(error) ? createRueWasmTrapDiagnostic(error) : error

const normalizeErrorDetails = (error: unknown): NormalizedErrorDetails => {
  const normalizedError = normalizeRueReportableError(error)

  if (normalizedError instanceof Error) {
    return {
      message: normalizedError.message || normalizedError.name || 'Unknown error',
      stack: normalizedError.stack || '',
    }
  }

  if (typeof normalizedError === 'string') {
    return {
      message: normalizedError,
      stack: '',
    }
  }

  if (normalizedError && typeof normalizedError === 'object') {
    const candidate = normalizedError as { message?: unknown; stack?: unknown; name?: unknown }
    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : typeof candidate.name === 'string'
          ? candidate.name
          : String(normalizedError)
    const stack = typeof candidate.stack === 'string' ? candidate.stack : ''
    return { message, stack }
  }

  return {
    message: String(normalizedError),
    stack: '',
  }
}
const getBrowserResourceTarget = (event: Event) => {
  const target = event.target as BrowserResourceTarget | null
  if (!target || typeof target !== 'object') {
    return null
  }

  const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : 'resource'
  const source =
    (typeof target.currentSrc === 'string' && target.currentSrc) ||
    (typeof target.src === 'string' && target.src) ||
    (typeof target.href === 'string' && target.href) ||
    ''

  return {
    tag,
    source,
    rel: typeof target.rel === 'string' ? target.rel.toLowerCase() : '',
  }
}

/**
 * 仅将足以破坏页面执行链的资源错误桥接给 Rue：
 * - script: 动态 chunk / 外部脚本加载失败，页面通常不可继续运行。
 * - link(rel=stylesheet/modulepreload/preload): 样式或预加载主资源失败，开发期需要尽快暴露。
 * 图片、音视频、favicon 等非致命资源失败不再弹出框架错误遮罩，避免刷新时被浏览器噪音打断。
 */
const isReportableBrowserResource = (target: ReturnType<typeof getBrowserResourceTarget>) => {
  if (!target) return false
  if (target.tag === 'script') return true
  if (target.tag !== 'link') return false

  return target.rel === 'stylesheet' || target.rel === 'modulepreload' || target.rel === 'preload'
}

const normalizeBrowserError = (event: Event | PromiseRejectionEvent): unknown | null => {
  if ('reason' in event && event.reason !== undefined) {
    return event.reason
  }

  if ('error' in event && event.error) {
    return event.error
  }

  const resourceTarget = getBrowserResourceTarget(event as Event)
  if (resourceTarget) {
    if (!isReportableBrowserResource(resourceTarget)) {
      return null
    }

    return new Error(
      resourceTarget.source
        ? `Failed to load ${resourceTarget.tag}: ${resourceTarget.source}`
        : `Failed to load ${resourceTarget.tag}`,
    )
  }

  if ('message' in event && typeof event.message === 'string' && event.message) {
    const filename = 'filename' in event && typeof event.filename === 'string' ? event.filename : ''

    if (event.message === 'Failed to load resource' && !filename) {
      return null
    }

    return new Error(filename ? `${event.message}: ${filename}` : event.message)
  }

  return new Error('Unhandled browser error')
}

const reportBrowserError = (error: unknown) => {
  const normalizedError = normalizeRueReportableError(error)

  if (error && typeof error === 'object') {
    if (bridgedBrowserErrors.has(error)) {
      return
    }
    bridgedBrowserErrors.add(error)
  }

  if (normalizedError && typeof normalizedError === 'object' && normalizedError !== error) {
    if (bridgedBrowserErrors.has(normalizedError)) {
      return
    }
    bridgedBrowserErrors.add(normalizedError)
  }

  ;(rue as any).handleError(normalizedError, null)
}

const installBrowserBridge = () => {
  if (typeof window === 'undefined') {
    return
  }

  if (bridgedWindow === window) {
    return
  }

  const handleWindowError = (event: Event) => {
    const normalized = normalizeBrowserError(event)
    if (normalized != null) {
      reportBrowserError(normalized)
    }
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const normalized = normalizeBrowserError(event)
    if (normalized != null) {
      reportBrowserError(normalized)
    }
  }

  window.addEventListener('error', handleWindowError, true)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  bridgedWindow = window
}

/** 安装错误处理能力
 * @param opts overlay/console 开关
 * @returns 组合 API：on/emit/installConsole/installOverlay
 */
export function useError(opts?: {
  /** 是否立即安装页面错误覆盖层。 */
  overlay?: boolean
  /** 是否立即安装控制台错误输出。 */
  console?: boolean
}) {
  /** 安装控制台输出处理 */
  const installConsole = () => {
    installBrowserBridge()
    onError((error: any) => {
      try {
        // 尝试读取错误堆栈；若不存在则为 ''
        const details = normalizeErrorDetails(error)
        const newline = String.fromCharCode(10)
        const consoleMessage = [
          '%cRue Error - The Wasm Framework For Native DOM%c',
          details.message,
          ...(details.stack ? [details.stack] : []),
        ].join(newline)
        ;(console as any).error?.(
          consoleMessage,
          // 标题样式：渐变背景 + 白色文字，以便在控制台中醒目显示
          'background:linear-gradient(to right, oklch(0.541 0.281 293.009) 0%, oklch(0.667 0.295 322.15) 50%, oklch(0.656 0.241 354.308) 100%);color:#fff;padding:5px 8px;font-size:15px;border-radius:5px;font-weight:900;letter-spacing:.02em;margin-bottom:0.5em',
          // 副标题样式：红色，强调错误性质
          'color:red;padding:3px 5px',
        )
      } catch {}
    })
  }

  /** 安装页面覆盖层处理 */
  const installOverlay = () => {
    installBrowserBridge()
    onError((error: any) => {
      const details = normalizeErrorDetails(error)
      let root = document.getElementById(RUE_ERROR_OVERLAY_ID)
      if (!root) {
        // 懒创建覆盖层根节点，挂载到 body
        root = document.createElement('div')
        root.id = RUE_ERROR_OVERLAY_ID
        document.body.appendChild(root)
      }
      const escapedMessage = escapeHtml(details.message)
      const escapedStack = details.stack ? escapeHtml(details.stack) : ''
      const overlayMarkup = [
        '<div id="rue-error-backdrop" class="fixed inset-0 z-50 bg-black/50 flex items-center justifycenter p-4">',
        '<div id="rue-error-dialog" class="w-full max-w-2xl rounded-md overflow-hidden bg-gray-900 text-gray-100 max-h-[80vh] flex flex-col">',
        '<div id="rue-error-header" class="flex items-center justify-between px-3 py-2 border-b border-gray-700 text-white" style="background:linear-gradient(to right, oklch(0.541 0.281 293.009) 0%, oklch(0.667 0.295 322.15) 50%, oklch(0.656 0.241 354.308) 100%)">',
        '<span class="text-sm font-bold">Rue Error</span>',
        '<button id="rue-error-close" aria-label="close" class="text-xs font-medium cursor-pointer hover:opacity-80">close</button>',
        '</div>',
        '<div class="p-4 text-sm leading-relaxed overflow-auto">',
        '<div class="font-semibold text-error break-words">' + escapedMessage + '</div>',
        ...(escapedStack
          ? [
              '<pre class="mt-3 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-3 text-xs text-gray-300">' +
                escapedStack +
                '</pre>',
            ]
          : []),
        '</div>',
        '</div>',
      ].join('')
      // 写入覆盖层结构（遮罩 + 对话框），内容含错误文案与关闭按钮
      setInnerHTML(root as any, overlayMarkup)
      // 绑定关闭行为：点击后移除覆盖层
      const close = root.querySelector('#rue-error-close') as HTMLButtonElement | null
      if (close)
        close.onclick = e => {
          e.preventDefault()
          if (root) root.remove()
        }
    })
  }

  /** 主动触发错误处理 */
  const emit = (error: any, instance?: any) => {
    // 委托给 Rue 的统一错误处理逻辑；instance 可用于关联组件上下文
    ;(rue as any).handleError(error, instance ?? null)
  }

  if (opts?.console) installConsole()
  if (opts?.overlay) installOverlay()

  return { on: onError, emit, installConsole, installOverlay }
}
