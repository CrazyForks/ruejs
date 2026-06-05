import {
  createTextElement,
  type TextComponentType,
  type TextElement,
  type TextNode,
  type TextRenderable,
} from '../runtime/render-protocol.js'
import { render as renderRue } from '@rue-js/rue'

type PagesComponent = TextComponentType<Record<string, unknown>>
type PagesAppComponent = TextComponentType<{
  Component: PagesComponent
  pageProps: Record<string, unknown>
}>
type PagesRouterContextWrapper = (element: TextElement) => TextElement
export type PagesClientRoot = {
  render(element: PagesClientRenderable): void
  unmount(): void
}
type PagesClientRenderable = TextNode
type RueClientRenderer = (element: unknown, container: Element) => void
const COMPONENT_PROBE_FAILED = Symbol('text.pages.clientComponentProbeFailed')

function renderRueRenderable(element: unknown, container: Element): void {
  renderRue(element as TextRenderable, container as HTMLElement)
}

function getRueClientRenderer(): RueClientRenderer {
  const renderer = (globalThis as Record<string, unknown>).__TEXT_RUE_RENDER__
  return typeof renderer === 'function' ? (renderer as RueClientRenderer) : renderRueRenderable
}

function tryCreateComponentElement(
  component: PagesComponent | PagesAppComponent,
  props: Record<string, unknown>,
): unknown | typeof COMPONENT_PROBE_FAILED {
  try {
    return component(props as never)
  } catch {
    return COMPONENT_PROBE_FAILED
  }
}

export function createPagesClientElement(options: {
  AppComponent?: PagesAppComponent | null
  PageComponent: PagesComponent
  pageProps: Record<string, unknown>
  wrapWithRouterContext?: PagesRouterContextWrapper | null
}): PagesClientRenderable {
  const probedElement = options.AppComponent
    ? tryCreateComponentElement(options.AppComponent, {
        Component: options.PageComponent,
        pageProps: options.pageProps,
      })
    : tryCreateComponentElement(options.PageComponent, options.pageProps)
  const element =
    probedElement !== COMPONENT_PROBE_FAILED
      ? probedElement
      : options.AppComponent
        ? createTextElement(options.AppComponent, {
            Component: options.PageComponent,
            pageProps: options.pageProps,
          })
        : createTextElement(options.PageComponent, options.pageProps)

  return options.wrapWithRouterContext
    ? options.wrapWithRouterContext(element as TextElement)
    : (element as TextNode)
}

export function hydratePagesClientRoot(
  container: Element,
  element: PagesClientRenderable,
): PagesClientRoot {
  let rueMounted = false

  const renderElement = (textElement: PagesClientRenderable): void => {
    const renderTextRue = getRueClientRenderer()
    renderTextRue(textElement, container)
    rueMounted = true
  }

  renderElement(element)

  return {
    render(textElement) {
      renderElement(textElement)
    },
    unmount() {
      if (rueMounted) {
        renderRueRenderable(null, container)
        rueMounted = false
      }
    },
  }
}
