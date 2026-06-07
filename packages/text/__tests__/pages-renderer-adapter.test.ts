import { describe, expect, it, vi } from 'vite-plus/test'
import type { TextRenderable } from '../src/server/renderable.js'
import {
  renderPagesRenderableToReadableStream,
  renderPagesRenderableToString,
} from '../src/server/pages-renderer-adapter.js'
import {
  ServerProtocolFragment,
  createServerProtocolElement,
} from '../src/server/element-protocol.js'

const LEGACY_RUNTIME_PACKAGE = ['re', 'act'].join('')

function createLegacyElement(
  type: unknown,
  props: Record<string, unknown> | null = null,
): TextRenderable {
  return createServerProtocolElement(type, props) as TextRenderable
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let html = ''
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    html += decoder.decode(chunk.value, { stream: true })
  }
  html += decoder.decode()
  return html
}

describe('pages renderer adapter', () => {
  it('renders host-only Rue protocol trees through the native Pages renderer', async () => {
    const element = createLegacyElement('main', {
      children: [
        createLegacyElement('h1', { children: 'Hello' }),
        createLegacyElement(ServerProtocolFragment, {
          children: createLegacyElement('p', { children: 'World' }),
        }),
      ],
    })
    const renderLegacy = vi.fn(async () => '<main>legacy</main>')
    const renderRue = vi.fn(async () => '<main>rue</main>')

    await expect(renderPagesRenderableToString(element, renderLegacy, renderRue)).resolves.toBe(
      '<main><h1>Hello</h1><p>World</p></main>',
    )

    expect(renderRue).not.toHaveBeenCalled()
    expect(renderLegacy).not.toHaveBeenCalled()
  })

  it('streams host-only Rue protocol trees through the native Pages renderer', async () => {
    const element = createLegacyElement('section', {
      children: createLegacyElement('p', { children: 'Streamed' }),
    })
    const renderLegacy = vi.fn(async () => {
      throw new Error('legacy renderer should not be used')
    })
    const renderRue = vi.fn(async () => '<section>rue-stream</section>')

    const stream = await renderPagesRenderableToReadableStream(element, renderLegacy, renderRue)

    await expect(readStream(stream)).resolves.toBe('<section><p>Streamed</p></section>')
    expect(renderRue).not.toHaveBeenCalled()
    expect(renderLegacy).not.toHaveBeenCalled()
  })

  it('renders component protocol elements through the native Pages renderer', async () => {
    function Component() {
      return createLegacyElement('div', { children: 'native' })
    }
    const element = createLegacyElement(Component, null)
    const renderLegacy = vi.fn(async () => '<div>legacy</div>')
    const renderRue = vi.fn(async () => '<div>rue</div>')

    await expect(renderPagesRenderableToString(element, renderLegacy, renderRue)).resolves.toBe(
      '<div>native</div>',
    )

    expect(renderRue).not.toHaveBeenCalled()
    expect(renderLegacy).not.toHaveBeenCalled()
  })

  it('streams Suspense protocol fallbacks before resolved content', async () => {
    let resolveLazy: (() => void) | undefined
    const LazyChild = () => {
      throw new Promise<void>(resolve => {
        resolveLazy = resolve
      })
    }
    Object.defineProperty(LazyChild, '__text_dynamic_loader__', {
      configurable: true,
      value: async () => () => createLegacyElement('strong', { children: 'resolved' }),
    })
    const element = createLegacyElement(Symbol.for(`${LEGACY_RUNTIME_PACKAGE}.suspense`), {
      fallback: createLegacyElement('span', { children: 'loading' }),
      children: createLegacyElement(LazyChild, null),
    })
    const renderLegacy = vi.fn(async () => {
      throw new Error('legacy renderer should not be used')
    })
    const renderRue = vi
      .fn<
        Parameters<NonNullable<Parameters<typeof renderPagesRenderableToReadableStream>[2]>>,
        ReturnType<NonNullable<Parameters<typeof renderPagesRenderableToReadableStream>[2]>>
      >()
      .mockResolvedValueOnce('<span>loading</span>')
      .mockResolvedValueOnce('<strong>resolved</strong>')

    const stream = await renderPagesRenderableToReadableStream(element, renderLegacy, renderRue)
    resolveLazy?.()

    await expect(readStream(stream)).resolves.toBe('<span>loading</span><strong>resolved</strong>')
    expect(renderLegacy).not.toHaveBeenCalled()
  })
})
