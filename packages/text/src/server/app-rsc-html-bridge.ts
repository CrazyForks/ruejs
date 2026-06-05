import type { TextNode as RueRenderableOutput } from '../runtime/render-protocol.js'
import type { TextCompatNode } from '../shims/text-compat-types.js'
import { createServerProtocolElement } from './element-protocol.js'

type RueServerRenderer = (element: RueRenderableOutput) => Promise<string> | string
type RueServerRendererModule = {
  renderToString?: RueServerRenderer
  default?: {
    renderToString?: RueServerRenderer
  }
}

function getInjectedRueServerRenderer(): RueServerRenderer | null {
  const renderer = (globalThis as Record<string, unknown>).__TEXT_RUE_RENDER_TO_STRING__
  return typeof renderer === 'function' ? (renderer as RueServerRenderer) : null
}

async function renderRueRenderableToString(value: RueRenderableOutput): Promise<string> {
  const injectedRenderer = getInjectedRueServerRenderer()
  if (injectedRenderer) {
    return injectedRenderer(value)
  }

  const rendererModule = (await import('@rue-js/server-renderer')) as RueServerRendererModule
  const renderToString =
    typeof rendererModule.renderToString === 'function'
      ? rendererModule.renderToString
      : typeof rendererModule.default?.renderToString === 'function'
        ? rendererModule.default.renderToString
        : null

  if (!renderToString) {
    throw new Error('text: @rue-js/server-renderer did not export renderToString.')
  }

  return renderToString(value)
}

export async function renderRueRenderableForRsc(
  value: RueRenderableOutput,
): Promise<TextCompatNode> {
  if (value == null || typeof value === 'boolean') {
    return null
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  const html = await renderRueRenderableToString(value)
  return createServerProtocolElement('text-rue-html', {
    'data-text-rue-html': '',
    dangerouslySetInnerHTML: { __html: html },
    suppressHydrationWarning: true,
  })
}
