/*
错误安装 API 概述
- 能力目标：统一错误捕获与呈现（控制台 + 页面覆盖层）。
- console：将错误堆栈以美化样式输出到控制台，突出显示标题与堆栈信息。
- overlay：在页面上显示可关闭的错误覆盖层（遮罩 + 对话框），开发阶段便于快速定位。
*/
import rue, { onError } from '../rue'
import { setInnerHTML } from '../dom'

const RUE_ERROR_OVERLAY_ID = 'rue-error-overlay'

type NormalizedErrorDetails = {
  message: string
  stack: string
}

type BrowserResourceTarget = EventTarget & {
  tagName?: string
  src?: string
  href?: string
  currentSrc?: string
  rel?: string
}

const browserBridges = new WeakMap<Window, { references: number; remove: () => void }>()

const once = (dispose: () => void): (() => void) => {
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    dispose()
  }
}
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

const normalizeErrorDetails = (error: unknown): NormalizedErrorDetails => {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown error',
      stack: error.stack || '',
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
      stack: '',
    }
  }

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; stack?: unknown; name?: unknown }
    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : typeof candidate.name === 'string'
          ? candidate.name
          : String(error)
    const stack = typeof candidate.stack === 'string' ? candidate.stack : ''
    return { message, stack }
  }

  return {
    message: String(error),
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
  if (error && typeof error === 'object') {
    if (bridgedBrowserErrors.has(error)) {
      return
    }
    bridgedBrowserErrors.add(error)
  }

  ;(rue as any).handleError(error, null)
}

/** 将浏览器错误接入 Rue；最后一个安装引用释放时移除监听器。 */
export function installBrowserErrorBridge(): () => void {
  if (typeof window === 'undefined') return () => {}
  const target = window
  const existing = browserBridges.get(target)
  if (existing) {
    existing.references++
    return once(() => {
      if (--existing.references === 0) existing.remove()
    })
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

  target.addEventListener('error', handleWindowError, true)
  target.addEventListener('unhandledrejection', handleUnhandledRejection)
  const state = {
    references: 1,
    remove: () => {
      target.removeEventListener('error', handleWindowError, true)
      target.removeEventListener('unhandledrejection', handleUnhandledRejection)
      browserBridges.delete(target)
    },
  }
  browserBridges.set(target, state)
  return once(() => {
    if (--state.references === 0) state.remove()
  })
}

/** 订阅 Rue 错误并输出到控制台；返回幂等清理函数。 */
export function installErrorConsole(): () => void {
  return once(
    onError((error: any) => {
      try {
        // 尝试读取错误堆栈；若不存在则为 ''
        const details = normalizeErrorDetails(error)
        const newline = String.fromCharCode(10)
        const consoleMessage = [
          '%cRue Error - The Compiler Framework For Native DOM%c',
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
    }),
  )
}

/** 在浏览器中订阅 Rue 错误并显示开发遮罩；清理时移除订阅和遮罩。 */
export function installDevErrorOverlay(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const targetDocument = document
  const stop = onError((error: any) => {
    const details = normalizeErrorDetails(error)
    let root = targetDocument.getElementById(RUE_ERROR_OVERLAY_ID)
    if (!root) {
      // 懒创建覆盖层根节点，挂载到 body
      root = targetDocument.createElement('div')
      root.id = RUE_ERROR_OVERLAY_ID
      targetDocument.body.appendChild(root)
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
  return once(() => {
    stop()
    targetDocument.getElementById(RUE_ERROR_OVERLAY_ID)?.remove()
  })
}
