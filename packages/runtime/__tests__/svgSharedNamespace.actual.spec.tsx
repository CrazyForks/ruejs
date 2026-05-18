import { afterEach, describe, expect, it } from 'vitest'

import { render, setReactiveScheduling, type FC } from '../src'

const SVG_NS = 'http://www.w3.org/2000/svg'
const HTML_NS = 'http://www.w3.org/1999/xhtml'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const SharedSvgLink: FC = () => (
  <a data-testid="component-svg-link" href="#component">
    <title data-testid="component-svg-title">component</title>
  </a>
)

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SVG shared namespace propagation', () => {
  it('uses the SVG namespace when rendering a shared root tag into an SVG container', () => {
    const container = document.createElementNS(SVG_NS, 'svg')

    document.body.appendChild(container)
    resetActiveRuntime()
    render(
      <a data-testid="svg-root-link" href="#root">
        root
      </a>,
      container as any,
    )

    const link = container.querySelector('[data-testid="svg-root-link"]') as Element | null

    expect(link?.namespaceURI).toBe(SVG_NS)
    expect(link?.tagName.toLowerCase()).toBe('a')
  })

  it('propagates SVG namespace through children and components but resets under foreignObject', () => {
    const container = document.createElement('div')

    document.body.appendChild(container)
    resetActiveRuntime()
    render(
      <svg data-testid="svg-root">
        <a data-testid="svg-link" href="#top">
          <title data-testid="svg-title">top</title>
        </a>
        <style data-testid="svg-style">{'.label{fill:red;}'}</style>
        <script data-testid="svg-script">{'window.__rue_svg_namespace_test = 1;'}</script>
        <SharedSvgLink />
        <foreignObject data-testid="foreign-object">
          <a data-testid="html-link" href="#html">
            html
          </a>
        </foreignObject>
      </svg>,
      container,
    )

    const svgLink = container.querySelector('[data-testid="svg-link"]') as Element | null
    const svgTitle = container.querySelector('[data-testid="svg-title"]') as Element | null
    const svgStyle = container.querySelector('[data-testid="svg-style"]') as Element | null
    const svgScript = container.querySelector('[data-testid="svg-script"]') as Element | null
    const componentLink = container.querySelector(
      '[data-testid="component-svg-link"]',
    ) as Element | null
    const componentTitle = container.querySelector(
      '[data-testid="component-svg-title"]',
    ) as Element | null
    const htmlLink = container.querySelector('[data-testid="html-link"]') as Element | null

    expect(svgLink?.namespaceURI, 'svgLink').toBe(SVG_NS)
    expect(svgTitle?.namespaceURI, 'svgTitle').toBe(SVG_NS)
    expect(svgStyle?.namespaceURI, 'svgStyle').toBe(SVG_NS)
    expect(svgScript?.namespaceURI, 'svgScript').toBe(SVG_NS)
    expect(componentLink?.namespaceURI, 'componentLink').toBe(SVG_NS)
    expect(componentTitle?.namespaceURI, 'componentTitle').toBe(SVG_NS)
    expect(htmlLink?.namespaceURI, 'htmlLink').toBe(HTML_NS)
  })
})
