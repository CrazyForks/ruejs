// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { h, renderAnchor, signal, vapor, type FC } from '@rue-js/runtime'
import {
  createIslandContainerHtml,
  deserializeIslandProps,
  hydrateRoot,
  mountRueIsland,
  registerRueIsland,
  serializeIslandProps,
  startRueIslandLoader,
} from '@rue-js/runtime/island'

import { flush, waitForContent } from './page-test-utils'

describe('Rue island runtime', () => {
  it('serializes props into script-safe JSON and restores typed values', () => {
    const serialized = serializeIslandProps({
      title: '</script><img src=x onerror=alert(1)>',
      createdAt: new Date('2026-06-22T00:00:00.000Z'),
      url: new URL('https://example.com/rue?x=1'),
    })

    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003C/script')

    const props = deserializeIslandProps(serialized)
    expect(props.title).toBe('</script><img src=x onerror=alert(1)>')
    expect(props.createdAt).toBeInstanceOf(Date)
    expect((props.createdAt as Date).toISOString()).toBe('2026-06-22T00:00:00.000Z')
    expect(props.url).toBeInstanceOf(URL)
    expect(String(props.url)).toBe('https://example.com/rue?x=1')
  })

  it('rejects unsupported or unsafe prop values instead of silently serializing them', () => {
    class CustomValue {
      label = 'custom'
    }
    const circular: any = { label: 'loop' }
    circular.self = circular

    expect(() => serializeIslandProps({ value: undefined })).toThrow(/undefined/)
    expect(() => serializeIslandProps({ value: () => {} })).toThrow(/function/)
    expect(() => serializeIslandProps({ value: Symbol('x') })).toThrow(/symbol/)
    expect(() => serializeIslandProps({ value: BigInt(1) })).toThrow(/bigint/)
    expect(() => serializeIslandProps({ value: Number.NaN })).toThrow(/non-finite/)
    expect(() => serializeIslandProps(circular)).toThrow(/circular/)
    expect(() => serializeIslandProps({ value: new CustomValue() })).toThrow(/CustomValue/)
  })

  it('emits island HTML with protocol attributes and a props script', () => {
    const html = createIslandContainerHtml({
      id: 'r1',
      component: '/src/Counter.tsx',
      entry: '/assets/Counter.js',
      hydrate: 'visible',
      props: { count: 1 },
      html: '<button>1</button>',
    })

    expect(html).toContain('<rue-island')
    expect(html).toContain('data-rue-id="r1"')
    expect(html).toContain('data-rue-component="/src/Counter.tsx"')
    expect(html).toContain('data-rue-hydrate="visible"')
    expect(html).toContain('<button>1</button>')
    expect(html).toContain('type="application/json"')
    expect(html).toContain('"count":1')
  })

  it('renders client:only fallback and omits props for client:none HTML', () => {
    const only = createIslandContainerHtml({
      id: 'map',
      component: '/src/Map.tsx',
      entry: '/src/Map.tsx',
      hydrate: 'only',
      props: { zoom: 12 },
      fallback: '<div>loading map</div>',
      html: '<div>server map should not render</div>',
    })
    const none = createIslandContainerHtml({
      id: 'copy',
      component: '/src/Copy.tsx',
      entry: '/src/Copy.tsx',
      hydrate: 'none',
      props: { ignored: true },
      html: '<p>static copy</p>',
    })

    expect(only).toContain('<div>loading map</div>')
    expect(only).not.toContain('server map should not render')
    expect(only).toContain('data-rue-hydrate="only"')
    expect(only).toContain('data-rue-props="map"')
    expect(none).toContain('<p>static copy</p>')
    expect(none).toContain('data-rue-hydrate="none"')
    expect(none).not.toContain('data-rue-entry=')
    expect(none).not.toContain('data-rue-props=')
  })

  it('hydrates load islands through a supplied module resolver', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'counter',
      component: '/src/Counter.tsx',
      entry: '/src/Counter.tsx',
      hydrate: 'load',
      props: { count: 2 },
      html: '<button>server</button>',
    })

    const Counter: FC<{ count: number }> = props => h('button', null, `client ${props.count}`)

    startRueIslandLoader({
      resolveModule: async () => ({ default: Counter }),
    })

    await waitForContent(() => {
      expect(document.body.textContent).toContain('client 2')
    })
    expect(document.querySelector('rue-island')?.getAttribute('data-rue-status')).toBe('hydrated')
  })

  it('adopts matching SSR DOM roots without replacing the root element', () => {
    document.body.innerHTML = `
      <div id="root">
        <button id="server-button">server</button>
        <script type="application/json" data-rue-props="counter">{"count":1}</script>
      </div>
    `
    const container = document.querySelector('#root')!
    const serverButton = container.querySelector('button')!
    const onMismatch = vi.fn()
    const onClick = vi.fn()

    const handle = hydrateRoot(
      container,
      h(
        'button',
        {
          className: 'hydrated',
          id: 'client-button',
          onClick,
          type: 'button',
        },
        'client',
      ),
      { replace: false, onMismatch },
    )

    const adoptedButton = container.querySelector('button')!
    expect(adoptedButton).toBe(serverButton)
    expect(adoptedButton.id).toBe('client-button')
    expect(adoptedButton.className).toBe('hydrated')
    expect(adoptedButton.textContent).toBe('client')
    expect(container.querySelector('script[data-rue-props]')).toBeNull()
    expect(onMismatch).not.toHaveBeenCalled()

    adoptedButton.click()
    expect(onClick).toHaveBeenCalledTimes(1)

    handle.unmount()
    adoptedButton.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(container.childNodes).toHaveLength(0)
  })

  it('falls back to replace-mode mounting when SSR and client roots do not match', () => {
    document.body.innerHTML = '<div id="root"><span id="server-root">server</span></div>'
    const container = document.querySelector('#root')!
    const serverRoot = container.firstElementChild
    const onMismatch = vi.fn()

    hydrateRoot(container, h('button', { type: 'button' }, 'client'), {
      replace: false,
      onMismatch,
    })

    const button = container.querySelector('button')
    expect(button).not.toBeNull()
    expect(button).not.toBe(serverRoot)
    expect(button?.textContent).toContain('client')
    expect(container.querySelector('#server-root')).toBeNull()
    expect(onMismatch).toHaveBeenCalledWith(
      'Rue hydrateRoot SSR root structure did not match the client element.',
      container,
    )
  })

  it('can opt into adopting component island roots through hydrateRoot', () => {
    document.body.innerHTML = '<div id="root"><section id="server-root">server</section></div>'
    const container = document.querySelector('#root')!
    const serverRoot = container.firstElementChild!
    const onClick = vi.fn()

    const StaticPanel: FC<{ label: string }> = props =>
      h('section', { className: 'hydrated', onClick }, props.label)

    hydrateRoot(container, h(StaticPanel, { label: 'client' }), {
      adoptComponents: true,
      replace: false,
    })

    const adoptedRoot = container.firstElementChild!
    expect(adoptedRoot).toBe(serverRoot)
    expect(adoptedRoot.className).toBe('hydrated')
    expect(adoptedRoot.textContent).toBe('client')

    adoptedRoot.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not unfold component handles for adoption unless explicitly requested', () => {
    document.body.innerHTML = '<div id="root"><section id="server-root">server</section></div>'
    const container = document.querySelector('#root')!
    const serverRoot = container.firstElementChild
    const onMismatch = vi.fn()

    const StaticPanel: FC<{ label: string }> = props => h('section', null, props.label)

    hydrateRoot(container, h(StaticPanel, { label: 'client' }), {
      replace: false,
      onMismatch,
    })

    const renderedRoot = container.firstElementChild
    expect(renderedRoot).not.toBe(serverRoot)
    expect(renderedRoot?.textContent).toContain('client')
    expect(onMismatch).toHaveBeenCalledWith(
      'Rue hydrateRoot could not find an adoptable element record.',
      container,
    )
  })

  it('asks hydrateRoot to adopt SSR DOM for opted-in default component islands', async () => {
    const island = document.createElement('rue-island')
    island.setAttribute('data-rue-hydrate', 'load')

    const Panel: FC = () => h('section', null, 'panel')
    const hydrateRootImpl = vi.fn()

    await mountRueIsland(
      island,
      { adopt: true, default: Panel },
      {
        island,
        props: {},
        strategy: 'load',
      },
      hydrateRootImpl,
    )

    expect(hydrateRootImpl).toHaveBeenCalledWith(
      island,
      expect.anything(),
      expect.objectContaining({ adoptComponents: true, replace: false }),
    )
  })

  it('retains matching SSR DOM for opted-in default component islands', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'static-panel',
      component: '/src/StaticPanel.tsx',
      entry: '/src/StaticPanel.tsx',
      hydrate: 'load',
      props: { label: 'client static panel' },
      html: '<section id="server-panel">server static panel</section>',
    })
    const serverPanel = document.querySelector('#server-panel')!

    const StaticPanel: FC<{ label: string }> = props =>
      h('section', { className: 'hydrated' }, props.label)
    const onMismatch = vi.fn()

    startRueIslandLoader({
      resolveModule: async () => ({ adopt: true, default: StaticPanel }),
      hydrateRoot: (container, value, options) =>
        hydrateRoot(container, value, { ...options, onMismatch }),
    })

    await waitForContent(() => {
      expect(document.querySelector('rue-island')?.getAttribute('data-rue-status')).toBe('hydrated')
    })

    const hydratedPanel = document.querySelector('rue-island section')!
    expect(hydratedPanel).toBe(serverPanel)
    expect(hydratedPanel.className).toBe('hydrated')
    expect(document.querySelector('script[data-rue-props]')).toBeNull()
    expect(onMismatch).not.toHaveBeenCalled()
  })

  it('morphs nested SSR children for opted-in component islands without replacing them', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'nested-list',
      component: '/src/NestedList.tsx',
      entry: '/src/NestedList.tsx',
      hydrate: 'load',
      props: {},
      html: [
        '<ul id="server-list" data-stale="remove-me">',
        '<li id="server-a" class="server">server A</li>',
        '<li id="server-b" class="server">server B</li>',
        '</ul>',
      ].join(''),
    })
    const serverList = document.querySelector('#server-list')!
    const serverA = document.querySelector('#server-a')!
    const serverB = document.querySelector('#server-b')!

    const NestedList: FC = () =>
      h(
        'ul',
        { id: 'client-list', 'data-fresh': 'yes' },
        h('li', { id: 'client-a', className: 'hydrated' }, 'client A'),
        h('li', { id: 'client-b', className: 'hydrated' }, 'client B'),
      )

    startRueIslandLoader({
      resolveModule: async () => ({ adopt: true, default: NestedList }),
    })

    await waitForContent(() => {
      expect(document.querySelector('rue-island')?.getAttribute('data-rue-status')).toBe('hydrated')
    })

    const hydratedList = document.querySelector('rue-island ul')!
    expect(hydratedList).toBe(serverList)
    expect(hydratedList.id).toBe('client-list')
    expect(hydratedList.getAttribute('data-stale')).toBeNull()
    expect(hydratedList.getAttribute('data-fresh')).toBe('yes')
    expect(document.querySelector('#client-a')).toBe(serverA)
    expect(document.querySelector('#client-b')).toBe(serverB)
    expect([...hydratedList.querySelectorAll('li')].map(li => li.textContent)).toEqual([
      'client A',
      'client B',
    ])
  })

  it('applies form state, removed attributes, and refs to renderer-adopted roots', () => {
    document.body.innerHTML =
      '<div id="root"><input id="server-input" class="server" value="server" disabled data-stale="yes"></div>'
    const container = document.querySelector('#root')!
    const serverInput = document.querySelector('#server-input') as HTMLInputElement
    const ref = { current: null as HTMLInputElement | null }

    const Field: FC = () =>
      h('input', {
        ref,
        id: 'client-input',
        className: 'hydrated',
        value: 'client',
        disabled: false,
        'data-fresh': 'yes',
      })

    hydrateRoot(container, h(Field, null), {
      adoptComponents: true,
      replace: false,
    })

    const hydratedInput = document.querySelector('#client-input') as HTMLInputElement
    expect(hydratedInput).toBe(serverInput)
    expect(hydratedInput.className).toBe('hydrated')
    expect(hydratedInput.value).toBe('client')
    expect(hydratedInput.disabled).toBe(false)
    expect(hydratedInput.getAttribute('data-stale')).toBeNull()
    expect(hydratedInput.getAttribute('data-fresh')).toBe('yes')
    expect(ref.current).toBe(serverInput)
  })

  it('binds stateful opted-in component islands to the adopted SSR DOM owner', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'stateful-counter',
      component: '/src/Counter.tsx',
      entry: '/src/Counter.tsx',
      hydrate: 'load',
      props: { initial: 1 },
      html: '<button id="server-count" class="server" type="button"><span>1</span></button>',
    })
    const serverButton = document.querySelector('#server-count')!

    const onIncrement = vi.fn()
    let latestCount = 0
    let updateRuns = 0
    const count = signal(1)
    let updateDom = () => {}
    const CounterValue: FC = () =>
      vapor(() => {
        const root = document.createElement('span')
        const anchor = document.createComment('counter-value')
        root.appendChild(anchor)
        updateDom = () => {
          updateRuns += 1
          renderAnchor(String(count.get()), root as any, anchor as any)
        }
        updateDom()
        return root as any
      }) as any

    const Counter: FC<{ initial: number }> = props => {
      count.set(props.initial)

      return (
        <button
          className="hydrated"
          id="client-count"
          onClick={() => {
            onIncrement()
            count.set(count.peek() + 1)
            latestCount = count.peek()
            updateDom()
          }}
          type="button"
        >
          <CounterValue />
        </button>
      )
    }

    const onMismatch = vi.fn()
    startRueIslandLoader({
      resolveModule: async () => ({ adopt: true, default: Counter }),
      hydrateRoot: (container, value, options) =>
        hydrateRoot(container, value, { ...options, onMismatch }),
    })

    await waitForContent(() => {
      expect(document.querySelector('rue-island')?.getAttribute('data-rue-status')).toBe('hydrated')
    })

    const hydratedButton = document.querySelector('rue-island button')!
    expect(hydratedButton).toBe(serverButton)
    expect(hydratedButton.id).toBe('client-count')
    expect(hydratedButton.className).toBe('hydrated')
    expect((hydratedButton as any).__rue_hydrated_adopted).toBe(true)
    expect(hydratedButton.textContent).toBe('1')

    hydratedButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()

    expect(onIncrement).toHaveBeenCalledTimes(1)
    expect(latestCount).toBe(2)
    expect(updateRuns).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('rue-island button')).toBe(serverButton)
    expect(serverButton.textContent).toBe('2')
  })

  it('removes transferred listeners from renderer-adopted roots on unmount', () => {
    document.body.innerHTML =
      '<div id="root"><button id="server-button" type="button"><span>server</span></button></div>'
    const container = document.querySelector('#root')!
    const serverButton = document.querySelector('#server-button') as HTMLButtonElement
    const onClick = vi.fn()
    const onMismatch = vi.fn()
    const label = signal('ready')
    let updateDom = () => {}

    const ButtonLabel: FC = () =>
      vapor(() => {
        const root = document.createElement('span')
        const anchor = document.createComment('button-label')
        root.appendChild(anchor)
        updateDom = () => renderAnchor(label.get(), root as any, anchor as any)
        updateDom()
        return root as any
      }) as any

    const Button: FC = () =>
      h('button', { id: 'client-button', onClick, type: 'button' }, h(ButtonLabel, null))

    const handle = hydrateRoot(container, h(Button, null), {
      adoptComponents: true,
      onMismatch,
      replace: false,
    })
    expect(onMismatch).not.toHaveBeenCalled()

    const hydratedButton = document.querySelector('#client-button') as HTMLButtonElement
    expect(hydratedButton).toBe(serverButton)
    hydratedButton.click()
    expect(onClick).toHaveBeenCalledTimes(1)

    label.set('updated')
    updateDom()
    expect(serverButton.textContent).toBe('updated')

    handle.unmount()
    expect(container.childNodes).toHaveLength(0)

    serverButton.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('cleans up renderer hydration attempts before falling back on component tag mismatch', () => {
    document.body.innerHTML = '<div id="root"><section id="server-root">server</section></div>'
    const container = document.querySelector('#root')!
    const onMismatch = vi.fn()

    const Article: FC = () => h('article', { id: 'client-root' }, 'client')

    hydrateRoot(container, h(Article, null), {
      adoptComponents: true,
      replace: false,
      onMismatch,
    })

    expect(container.querySelector('#server-root')).toBeNull()
    expect(container.querySelector('#client-root')?.tagName).toBe('ARTICLE')
    expect(container.textContent).toBe('client')
    expect(
      [...container.childNodes].some(
        node => node.nodeType === Node.COMMENT_NODE && node.textContent === 'rue-hydration-root',
      ),
    ).toBe(false)
    expect(onMismatch).toHaveBeenCalledWith(
      'Rue hydrateRoot SSR root structure did not match the client element.',
      container,
    )
  })

  it('client:only islands replace fallback with client-rendered content', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'map',
      component: '/src/Map.tsx',
      entry: '/src/Map.tsx',
      hydrate: 'only',
      props: { label: 'Map ready' },
      fallback: '<span>Loading map</span>',
    })

    const Map: FC<{ label: string }> = props => h('strong', null, props.label)

    expect(document.body.textContent).toContain('Loading map')
    startRueIslandLoader({
      resolveModule: async () => ({ default: Map }),
    })

    await waitForContent(() => {
      expect(document.querySelector('rue-island strong')?.textContent).toBe('Map ready')
    })
    expect(document.body.textContent).not.toContain('Loading map')
  })

  it('skips client:none islands', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'static',
      component: '/src/Static.tsx',
      hydrate: 'none',
      html: '<p>static html</p>',
    })

    const resolveModule = vi.fn()
    startRueIslandLoader({ resolveModule })
    await flush()

    expect(resolveModule).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('static html')
    expect(document.querySelector('rue-island')?.getAttribute('data-rue-status')).toBe('static')
  })

  it('waits for idle before loading idle islands', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'idle',
      component: '/src/Idle.tsx',
      entry: '/src/Idle.tsx',
      hydrate: 'idle',
      html: '<p>idle server</p>',
    })

    const originalRequestIdle = window.requestIdleCallback
    const originalCancelIdle = window.cancelIdleCallback
    let idleCallback: (() => void) | null = null
    ;(window as any).requestIdleCallback = vi.fn((cb: () => void) => {
      idleCallback = cb
      return 7
    })
    ;(window as any).cancelIdleCallback = vi.fn()

    try {
      const resolveModule = vi.fn(async () => ({
        mount: (island: Element) => {
          island.textContent = 'idle hydrated'
        },
      }))

      registerRueIsland(document.querySelector('rue-island')!, { resolveModule })
      await flush()
      expect(resolveModule).not.toHaveBeenCalled()

      expect(idleCallback).not.toBeNull()
      ;(idleCallback as unknown as () => void)()
      await waitForContent(() => {
        expect(document.body.textContent).toContain('idle hydrated')
      })
      expect(resolveModule).toHaveBeenCalledTimes(1)
    } finally {
      window.requestIdleCallback = originalRequestIdle
      window.cancelIdleCallback = originalCancelIdle
    }
  })

  it('waits for media query matches before hydrating media islands', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'media',
      component: '/src/Media.tsx',
      entry: '/src/Media.tsx',
      hydrate: 'media',
      media: '(min-width: 900px)',
      html: '<p>media server</p>',
    })

    const originalMatchMedia = window.matchMedia
    let matches = false
    let changeListener: (() => void) | null = null
    ;(window as any).matchMedia = vi.fn(() => ({
      get matches() {
        return matches
      },
      addEventListener: (_event: string, listener: () => void) => {
        changeListener = listener
      },
      removeEventListener: vi.fn(),
    }))

    try {
      const resolveModule = vi.fn(async () => ({
        mount: (island: Element) => {
          island.textContent = 'media hydrated'
        },
      }))

      registerRueIsland(document.querySelector('rue-island')!, { resolveModule })
      await flush()
      expect(resolveModule).not.toHaveBeenCalled()

      matches = true
      expect(changeListener).not.toBeNull()
      ;(changeListener as unknown as () => void)()
      await waitForContent(() => {
        expect(document.body.textContent).toContain('media hydrated')
      })
      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 900px)')
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })

  it('waits for visible islands to intersect before hydrating', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'visible',
      component: '/src/Visible.tsx',
      entry: '/src/Visible.tsx',
      hydrate: 'visible',
      html: '<p>visible server</p>',
    })

    const originalObserver = window.IntersectionObserver
    let observerCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    ;(window as any).IntersectionObserver = class {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallback = callback
      }
    }

    try {
      const resolveModule = vi.fn(async () => ({
        mount: (island: Element) => {
          island.textContent = 'visible hydrated'
        },
      }))

      registerRueIsland(document.querySelector('rue-island')!, { resolveModule })
      await flush()
      expect(resolveModule).not.toHaveBeenCalled()

      expect(observerCallback).not.toBeNull()
      const fireObserver = observerCallback as unknown as (
        entries: Array<{ isIntersecting: boolean }>,
      ) => void
      fireObserver([{ isIntersecting: false }])
      await flush()
      expect(resolveModule).not.toHaveBeenCalled()

      fireObserver([{ isIntersecting: true }])
      await waitForContent(() => {
        expect(document.body.textContent).toContain('visible hydrated')
      })
      expect(resolveModule).toHaveBeenCalledTimes(1)
    } finally {
      window.IntersectionObserver = originalObserver
    }
  })

  it('uses manifest props when no props script is present', async () => {
    document.body.innerHTML =
      '<rue-island data-rue-id="manifest-only" data-rue-component="/src/Manifest.tsx" data-rue-hydrate="load"><span>server</span></rue-island>'

    const ManifestPanel: FC<{ label: string }> = props => h('span', null, props.label)

    startRueIslandLoader({
      manifest: {
        'manifest-only': {
          component: '/src/Manifest.tsx',
          entry: '/src/Manifest.tsx',
          hydrate: 'load',
          props: serializeIslandProps({ label: 'from manifest' }),
        },
      },
      resolveModule: async () => ({ default: ManifestPanel }),
    })

    await waitForContent(() => {
      expect(document.body.textContent).toContain('from manifest')
    })
  })

  it('waits for interaction islands and passes the triggering event to hydrate()', async () => {
    document.body.innerHTML = createIslandContainerHtml({
      id: 'interactive',
      component: '/src/Button.tsx',
      entry: '/src/Button.tsx',
      hydrate: 'interaction',
      interaction: 'click',
      props: { label: 'Run' },
      html: '<button>server</button>',
    })

    const hydrate = vi.fn((island: Element, props: any, context: any) => {
      island.textContent = `${props.label}:${context.replayEvent.type}`
    })
    const island = document.querySelector('rue-island')!

    registerRueIsland(island, {
      resolveModule: async () => ({ hydrate }),
    })
    await flush()
    expect(hydrate).not.toHaveBeenCalled()

    island.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitForContent(() => {
      expect(document.body.textContent).toContain('Run:click')
    })
  })
})
