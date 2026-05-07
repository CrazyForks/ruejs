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

let browserBridgeInstalled = false
const bridgedBrowserErrors = new WeakSet<object>()

const escapeHtml = (value: string) =>
  value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;')

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

const normalizeBrowserError = (event: Event | PromiseRejectionEvent): unknown => {
  if ('reason' in event && event.reason !== undefined) {
    return event.reason
  }

  if ('error' in event && event.error) {
    return event.error
  }

  const target = (event as Event).target as
    | (EventTarget & { tagName?: string; src?: string; href?: string })
    | null
  if (target && typeof target === 'object') {
    const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : 'resource'
    const source =
      (typeof target.src === 'string' && target.src) ||
      (typeof target.href === 'string' && target.href) ||
      ''
    return new Error(source ? `Failed to load ${tag}: ${source}` : `Failed to load ${tag}`)
  }

  if ('message' in event && typeof event.message === 'string' && event.message) {
    return new Error(event.message)
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

const installBrowserBridge = () => {
  if (browserBridgeInstalled || typeof window === 'undefined') {
    return
  }

  const handleWindowError = (event: Event) => {
    reportBrowserError(normalizeBrowserError(event))
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportBrowserError(normalizeBrowserError(event))
  }

  window.addEventListener('error', handleWindowError, true)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  browserBridgeInstalled = true
}

/** 安装错误处理能力
 * @param opts overlay/console 开关
 * @returns 组合 API：on/emit/installConsole/installOverlay
 */
export function useError(opts?: { overlay?: boolean; console?: boolean }) {
  /** 安装控制台输出处理 */
  const installConsole = () => {
    installBrowserBridge()
    onError((error: any) => {
      try {
        // 尝试读取错误堆栈；若不存在则为 ''
        const details = normalizeErrorDetails(error)
        ;(console as any).error?.(
          '%cRue Error - The Wasm Framework For Vapor Native DOM%c\n' + details.message + (details.stack ? `\n${details.stack}` : ''),
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
      // 写入覆盖层结构（遮罩 + 对话框），内容含错误文案与关闭按钮
      setInnerHTML(
        root as any,
        `
        <div id="rue-error-backdrop" class="fixed inset-0 z-50 bg-black/50 flex items-center justifycenter p-4">
          <div id="rue-error-dialog" class="w-full max-w-2xl rounded-md overflow-hidden bg-gray-900 text-gray-100 max-h-[80vh] flex flex-col">
            <div id="rue-error-header" class="flex items-center justify-between px-3 py-2 border-b border-gray-700 text-white" style="background:linear-gradient(to right, oklch(0.541 0.281 293.009) 0%, oklch(0.667 0.295 322.15) 50%, oklch(0.656 0.241 354.308) 100%)">
              <span class="text-sm font-bold">Rue Error</span>
              <button id="rue-error-close" aria-label="close" class="text-xs font-medium cursor-pointer hover:opacity-80">close</button>
            </div>
            <div class="p-4 text-sm leading-relaxed overflow-auto">
              <div class="font-semibold text-error-content mb-3 break-words">${escapedMessage}</div>
              ${escapedStack ? `<pre class="text-xs leading-5 whitespace-pre-wrap break-words opacity-90">${escapedStack}</pre>` : ''}
            </div>
          </div>
        </div>
      `,
      )
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
