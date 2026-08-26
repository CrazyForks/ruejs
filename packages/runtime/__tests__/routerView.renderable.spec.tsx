import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachRouter,
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  RouterView,
} from '@rue-js/router'

import {
  onMounted,
  onUnmounted,
  ref,
  render,
  setReactiveScheduling,
  useComponent,
  useState,
  type FC,
} from '../src'
import ExamplePlayground from '../../../app/pages/examples/ExamplePlayground'
import AttributeBindings from '../../../app/pages/examples/AttributeBindings'
import HandlingInput from '../../../app/pages/examples/HandlingInput'
import HelloWorld from '../../../app/pages/examples/HelloWorld'
import SidebarPlaygroundDesign, {
  DesignRouteLayout,
} from '../../../app/pages/site/SidebarPlaygroundDesign'
import SidebarPlaygroundExample, {
  ExamplesRouteLayout,
} from '../../../app/pages/site/SidebarPlaygroundExample'
import SidebarPlaygroundApi, { ApiRouteLayout } from '../../../app/pages/site/SidebarPlaygroundApi'
import SidebarPlaygroundGuide, {
  GuideRouteLayout,
} from '../../../app/pages/site/SidebarPlaygroundGuide'
import UseStateCounterDemo from '../../../app/pages/examples/home-demos/UseStateCounterDemo'
import { createAppRouter } from '../../../app/router'
import { waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

const mountedContainers: HTMLDivElement[] = []

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const mountTestContainer = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  mountedContainers.push(container)
  return container
}

afterEach(() => {
  resetActiveRuntime()
  for (const container of mountedContainers) {
    render(null as any, container)
  }
  mountedContainers.length = 0
  document.body.innerHTML = ''
  window.location.hash = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  setReactiveScheduling('sync')
  resetActiveRuntime()
  document.body.innerHTML = ''
  window.location.hash = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const UserRoute: FC<{ params: { id: string } }> = props => (
  <section data-testid="route-user">user:{props.params.id}</section>
)

const OtherRoute: FC = () => <section data-testid="route-other">other</section>
const slowTestTimeout = 40_000

describe('RouterView renderable boundary', () => {
  it('preserves persist route state while non-persist routes reset', async () => {
    const persistMounted = vi.fn()
    const persistUnmounted = vi.fn()
    const plainMounted = vi.fn()

    const PersistCounter: FC = () => {
      const [count, setCount] = useState(0)
      onMounted(persistMounted)
      onUnmounted(persistUnmounted)
      return (
        <button
          data-testid="persist-counter"
          onClick={() => setCount(value => void (value.value += 1))}
        >
          persist:{count.value}
        </button>
      )
    }
    const PlainCounter: FC = () => {
      const [count, setCount] = useState(0)
      onMounted(plainMounted)
      return (
        <button
          data-testid="plain-counter"
          onClick={() => setCount(value => void (value.value += 1))}
        >
          plain:{count.value}
        </button>
      )
    }
    const router = createRouter({
      history: createMemoryHistory('/persist'),
      routes: [
        { path: '/persist', component: PersistCounter, persist: true },
        { path: '/plain', component: PlainCounter },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)
    const container = mountTestContainer()
    render(<RouterView />, container)
    await flush()

    container
      .querySelector('[data-testid="persist-counter"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await router.push('/plain')
    await flush()
    container
      .querySelector('[data-testid="plain-counter"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await router.push('/other')
    await flush()
    await router.push('/plain')
    await flush()
    expect(container.querySelector('[data-testid="plain-counter"]')?.textContent).toBe('plain:0')

    await router.push('/persist')
    await flush()
    expect(container.querySelector('[data-testid="persist-counter"]')?.textContent).toBe(
      'persist:1',
    )
    expect(persistMounted).toHaveBeenCalledTimes(1)
    expect(persistUnmounted).not.toHaveBeenCalled()
    expect(plainMounted).toHaveBeenCalledTimes(2)
  })

  it('updates params on a reactivated persist record without remounting it', async () => {
    const mounted = vi.fn()
    const User: FC<{ params: { id: string } }> = ({ params }) => {
      const [count, setCount] = useState(0)
      onMounted(mounted)
      return (
        <button
          data-testid="persist-user"
          onClick={() => setCount(value => void (value.value += 1))}
        >
          user:{params.id}:{count.value}
        </button>
      )
    }
    const router = createRouter({
      history: createMemoryHistory('/users/1'),
      routes: [
        { path: '/users/:id', component: User, persist: true },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)
    const container = mountTestContainer()
    render(<RouterView />, container)
    await flush()
    container
      .querySelector('[data-testid="persist-user"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await router.push('/other')
    await flush()
    await router.push('/users/2')
    await flush()

    expect(container.querySelector('[data-testid="persist-user"]')?.textContent).toBe('user:2:1')
    expect(mounted).toHaveBeenCalledTimes(1)
  })

  it('cleans cached persist routes when the root RouterView unmounts', async () => {
    const unmounted = vi.fn()
    const Cached: FC = () => {
      onUnmounted(unmounted)
      return <div>cached</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/cached'),
      routes: [
        { path: '/cached', component: Cached, persist: true, persistKey: 'cached-page' },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)
    const container = mountTestContainer()
    render(<RouterView />, container)
    await flush()
    await router.push('/other')
    await flush()
    expect(unmounted).not.toHaveBeenCalled()

    render(null as any, container)
    await flush()
    await flush()
    expect(container.innerHTML).toBe('')
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  it('updates same-component params and clears old route content across switches', async () => {
    window.location.hash = '#/users/1'

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/users/:id', component: UserRoute },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    expect(container.textContent).toBe('user:1')

    router.push('/users/2')
    await flush()
    expect(container.textContent).toBe('user:2')
    expect(container.querySelectorAll('[data-testid="route-user"]').length).toBe(1)

    router.push('/other')
    await flush()
    expect(container.textContent).toBe('other')
    expect(container.querySelector('[data-testid="route-user"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="route-other"]').length).toBe(1)
  })

  it('replays a stable route result when switching away and back', async () => {
    const stableRouteResult = <section data-testid="stable-route">stable</section>
    const StableRoute: FC = () => stableRouteResult
    const router = createRouter({
      history: createMemoryHistory('/stable'),
      routes: [
        { path: '/stable', component: StableRoute },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)
    const container = mountTestContainer()

    render(<RouterView />, container)
    await flush()
    expect(container.querySelector('[data-testid="stable-route"]')?.textContent).toBe('stable')

    await router.push('/other')
    await flush()
    expect(container.querySelector('[data-testid="route-other"]')?.textContent).toBe('other')

    await router.push('/stable')
    await flush()
    expect(container.querySelector('[data-testid="stable-route"]')?.textContent).toBe('stable')
  })

  it('fires route component onUnmounted when switching away', async () => {
    window.location.hash = '#/tracked'

    const unmounted = vi.fn()
    const TrackedRoute: FC = () => {
      onUnmounted(unmounted)
      return <section data-testid="route-tracked">tracked</section>
    }

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/tracked', component: TrackedRoute },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    expect(container.textContent).toBe('tracked')

    router.push('/other')
    await flush()

    expect(container.textContent).toBe('other')
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  it('fires lazy route component onUnmounted when switching away', async () => {
    window.location.hash = '#/tracked'

    const unmounted = vi.fn()
    const TrackedRoute: FC = () => {
      onUnmounted(unmounted)
      return <section data-testid="route-tracked">tracked</section>
    }
    const LazyTrackedRoute = useComponent(async () => ({ default: TrackedRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/tracked', component: LazyTrackedRoute },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    expect(container.textContent).toBe('tracked')

    router.push('/other')
    await flush()

    expect(container.textContent).toBe('other')
    expect(unmounted).toHaveBeenCalledTimes(1)
  })

  it('keeps design sidebar layout mounted while design child routes switch', async () => {
    const DesignChild: FC<{ label: string }> = ({ label }) => (
      <SidebarPlaygroundDesign>
        <h1>{label}</h1>
      </SidebarPlaygroundDesign>
    )

    const router = createRouter({
      history: createMemoryHistory('/design/button'),
      routes: [
        {
          path: '/design',
          component: DesignRouteLayout,
          children: [
            { path: 'button', component: () => <DesignChild label="Button page" /> },
            { path: 'tabs', component: () => <DesignChild label="Tabs page" /> },
          ],
        },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    const layoutRoot = container.querySelector('.sidebar-playground')
    expect(layoutRoot).toBeTruthy()
    expect(container.querySelectorAll('.sidebar-playground')).toHaveLength(1)
    expect(container.textContent).toContain('Button page')

    await router.push('/design/tabs')
    await router.isReady()
    await flush()
    await flush()

    expect(container.querySelector('.sidebar-playground')).toBe(layoutRoot)
    expect(container.querySelectorAll('.sidebar-playground')).toHaveLength(1)
    expect(container.textContent).toContain('Tabs page')
    expect(container.textContent).not.toContain('Button page')
  })

  it('keeps docs and examples sidebar layouts mounted while child routes switch', async () => {
    const cases: {
      basePath: string
      layoutId: string
      Layout: FC
      Sidebar: FC
    }[] = [
      { basePath: '/api', layoutId: 'api', Layout: ApiRouteLayout, Sidebar: SidebarPlaygroundApi },
      {
        basePath: '/examples',
        layoutId: 'examples',
        Layout: ExamplesRouteLayout,
        Sidebar: SidebarPlaygroundExample,
      },
      {
        basePath: '/guide',
        layoutId: 'guide',
        Layout: GuideRouteLayout,
        Sidebar: SidebarPlaygroundGuide,
      },
    ]

    for (const current of cases) {
      const Child: FC<{ label: string }> = ({ label }) => (
        <current.Sidebar>
          <h1>{label}</h1>
        </current.Sidebar>
      )

      const router = createRouter({
        history: createMemoryHistory(`${current.basePath}/first`),
        routes: [
          {
            path: current.basePath,
            component: current.Layout,
            meta: {
              sidebarPlaygroundLayout: current.layoutId,
            },
            children: [
              { path: 'first', component: () => <Child label="First page" /> },
              { path: 'second', component: () => <Child label="Second page" /> },
            ],
          },
        ],
      })
      attachRouter(router)

      const container = mountTestContainer()
      render(<RouterView />, container)

      await flush()
      await flush()

      const layoutRoot = container.querySelector('.sidebar-playground')
      expect(layoutRoot).toBeTruthy()
      expect(container.querySelectorAll('.sidebar-playground')).toHaveLength(1)
      expect(container.textContent).toContain('First page')

      await router.push(`${current.basePath}/second`)
      await router.isReady()
      await flush()
      await flush()

      expect(container.querySelector('.sidebar-playground')).toBe(layoutRoot)
      expect(container.querySelectorAll('.sidebar-playground')).toHaveLength(1)
      expect(container.textContent).toContain('Second page')
      expect(container.textContent).not.toContain('First page')

      render(null as any, container)
    }
  })

  it('restores async leaf content while switching across real sidebar route layouts', async () => {
    setReactiveScheduling('sync')
    const router = createAppRouter(createMemoryHistory('/'))
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Framework For Native DOM')
    })

    await router.push('/examples/hello-world')
    await waitForContent(() => {
      expect(container.querySelector('.sidebar-playground')).toBeTruthy()
      expect(container.textContent).toContain('你好，世界（移植自 Vue）')
    }, 400)

    await router.push('/guide/guide/quick-start')
    await waitForContent(() => {
      expect(container.querySelector('.sidebar-playground')).toBeTruthy()
      expect(container.querySelector('#doc-body')?.textContent).toContain('快速开始')
      expect(container.querySelector('#doc-body')?.textContent).toContain('创建 Rue 应用')
      expect(container.textContent).not.toContain('你好，世界（移植自 Vue）')
    }, 400)

    await router.push('/examples/hello-world')
    await waitForContent(() => {
      expect(container.querySelector('.sidebar-playground')).toBeTruthy()
      expect(container.textContent).toContain('你好，世界（移植自 Vue）')
      expect(container.querySelector('#doc-body')).toBeNull()
    }, 400)
  })

  it('keeps lazy route page interactions reactive through a preview shell', async () => {
    window.location.hash = '#/demo'

    const Counter: FC = () => {
      const [count, setCount] = useState(0)

      return (
        <button
          data-testid="route-lazy-counter"
          onClick={() =>
            setCount(value => {
              value.value += 1
            })
          }
        >
          {count.value}
        </button>
      )
    }

    const PreviewShell: FC<{ children?: unknown }> = props => {
      const activeTab = ref<'preview' | 'code'>('preview')

      return (
        <section>
          <button data-testid="route-preview-tab" onClick={() => (activeTab.value = 'preview')}>
            preview
          </button>
          <button data-testid="route-code-tab" onClick={() => (activeTab.value = 'code')}>
            code
          </button>
          {activeTab.value === 'preview' && (
            <div data-testid="route-preview-shell">{props.children}</div>
          )}
          {activeTab.value === 'code' && <div data-testid="route-code-shell">code</div>}
        </section>
      )
    }

    const LazyDemoRoute: FC = () => (
      <PreviewShell>
        <Counter />
      </PreviewShell>
    )

    const LazyRoute = useComponent(async () => ({ default: LazyDemoRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/demo', component: LazyRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    const button = container.querySelector(
      '[data-testid="route-lazy-counter"]',
    ) as HTMLButtonElement
    expect(button?.textContent).toBe('0')

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(button.textContent).toBe('1')
  })

  it('keeps local interactions reactive after switching between plain lazy routes', async () => {
    window.location.hash = '#/first'

    const FirstRoute: FC = () => <section data-testid="plain-first">first</section>

    const SecondRoute: FC = () => {
      const activeTab = ref<'preview' | 'code'>('preview')

      return (
        <section>
          <button data-testid="plain-preview-tab" onClick={() => (activeTab.value = 'preview')}>
            preview
          </button>
          <button data-testid="plain-code-tab" onClick={() => (activeTab.value = 'code')}>
            code
          </button>
          {activeTab.value === 'preview' && <div data-testid="plain-preview-panel">preview</div>}
          {activeTab.value === 'code' && <div data-testid="plain-code-panel">code</div>}
        </section>
      )
    }

    const LazyFirstRoute = useComponent(async () => ({ default: FirstRoute }))
    const LazySecondRoute = useComponent(async () => ({ default: SecondRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/first', component: LazyFirstRoute },
        { path: '/second', component: LazySecondRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    expect(container.textContent).toContain('first')

    router.push('/second')
    await flush()
    await flush()

    expect(container.textContent).toContain('preview')
    expect(container.querySelector('[data-testid="plain-preview-panel"]')).toBeTruthy()

    const codeTab = container.querySelector('[data-testid="plain-code-tab"]') as
      | HTMLButtonElement
      | undefined
    expect(codeTab).toBeTruthy()

    codeTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(container.querySelector('[data-testid="plain-code-panel"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="plain-preview-panel"]')).toBeNull()
  })

  it('keeps plain lazy route interactions reactive after switching away and back', async () => {
    window.location.hash = '#/first'

    const FirstRoute: FC = () => {
      const activeTab = ref<'preview' | 'code'>('preview')

      return (
        <section>
          <button data-testid="roundtrip-preview-tab" onClick={() => (activeTab.value = 'preview')}>
            preview
          </button>
          <button data-testid="roundtrip-code-tab" onClick={() => (activeTab.value = 'code')}>
            code
          </button>
          {activeTab.value === 'preview' && (
            <div data-testid="roundtrip-preview-panel">preview</div>
          )}
          {activeTab.value === 'code' && <div data-testid="roundtrip-code-panel">code</div>}
        </section>
      )
    }

    const SecondRoute: FC = () => <section data-testid="roundtrip-second">second</section>

    const LazyFirstRoute = useComponent(async () => ({ default: FirstRoute }))
    const LazySecondRoute = useComponent(async () => ({ default: SecondRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/first', component: LazyFirstRoute },
        { path: '/second', component: LazySecondRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    expect(container.querySelector('[data-testid="roundtrip-preview-panel"]')).toBeTruthy()

    router.push('/second')
    await flush()
    await flush()

    expect(container.querySelector('[data-testid="roundtrip-second"]')).toBeTruthy()

    router.push('/first')
    await flush()
    await flush()

    const codeTab = container.querySelector('[data-testid="roundtrip-code-tab"]') as
      | HTMLButtonElement
      | undefined
    expect(codeTab).toBeTruthy()

    codeTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(container.querySelector('[data-testid="roundtrip-code-panel"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="roundtrip-preview-panel"]')).toBeNull()
  })

  it('does not duplicate plain lazy route panels after repeated route revisits', async () => {
    window.location.hash = '#/first'

    const FirstRoute: FC = () => {
      const activeTab = ref<'preview' | 'code'>('preview')

      return (
        <section>
          <button data-testid="dedupe-preview-tab" onClick={() => (activeTab.value = 'preview')}>
            preview
          </button>
          <button data-testid="dedupe-code-tab" onClick={() => (activeTab.value = 'code')}>
            code
          </button>
          {activeTab.value === 'preview' && <div data-testid="dedupe-preview-panel">preview</div>}
          {activeTab.value === 'code' && <div data-testid="dedupe-code-panel">code</div>}
        </section>
      )
    }

    const SecondRoute: FC = () => <section data-testid="dedupe-second">second</section>

    const LazyFirstRoute = useComponent(async () => ({ default: FirstRoute }))
    const LazySecondRoute = useComponent(async () => ({ default: SecondRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/first', component: LazyFirstRoute },
        { path: '/second', component: LazySecondRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    router.push('/second')
    await flush()
    await flush()
    router.push('/first')
    await flush()
    await flush()
    router.push('/second')
    await flush()
    await flush()
    router.push('/first')
    await flush()
    await flush()

    expect(container.querySelectorAll('[data-testid="dedupe-preview-panel"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="dedupe-code-panel"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="dedupe-code-tab"]')).toHaveLength(1)

    const codeTab = container.querySelector('[data-testid="dedupe-code-tab"]') as HTMLButtonElement
    codeTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(container.querySelectorAll('[data-testid="dedupe-preview-panel"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="dedupe-code-panel"]')).toHaveLength(1)
  })

  it('keeps lazy route interactions reactive inside the real sidebar playground shell', async () => {
    window.location.hash = '#/examples/demo'

    const SidebarDemoRoute: FC = () => (
      <SidebarPlaygroundExample>
        <UseStateCounterDemo />
      </SidebarPlaygroundExample>
    )

    const LazyRoute = useComponent(async () => ({ default: SidebarDemoRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/examples/demo', component: LazyRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    const button = Array.from(container.querySelectorAll('button')).find(
      current => current.textContent?.trim() === '+1',
    ) as HTMLButtonElement | undefined

    expect(button?.textContent).toBe('+1')

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(container.textContent).toContain('1')
  })

  it('keeps lazy route interactions reactive inside the real example playground page shell', async () => {
    window.location.hash = '#/examples/demo'

    const ExampleRoute: FC = () => (
      <ExamplePlayground title="useState 计数器" source="demo source">
        <UseStateCounterDemo />
      </ExamplePlayground>
    )

    const LazyRoute = useComponent(async () => ({ default: ExampleRoute }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/examples/demo', component: LazyRoute },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    const button = Array.from(container.querySelectorAll('button')).find(
      current => current.textContent?.trim() === '+1',
    ) as HTMLButtonElement | undefined

    expect(button?.textContent).toBe('+1')

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(container.textContent).toContain('1')
  })

  it('switches between real example routes from the sidebar without a full refresh', async () => {
    window.location.hash = '#/examples/handling-input'

    const LazyHandlingInput = useComponent(async () => ({ default: HandlingInput }))
    const LazyAttributeBindings = useComponent(async () => ({ default: AttributeBindings }))

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/', component: OtherRoute },
        { path: '/examples/handling-input', component: LazyHandlingInput },
        { path: '/examples/attribute-bindings', component: LazyAttributeBindings },
      ],
    })
    attachRouter(router)

    const container = mountTestContainer()
    render(<RouterView />, container)

    await flush()
    await flush()

    expect(container.textContent).toContain('处理输入（移植自 Vue）')

    const codeTab = Array.from(container.querySelectorAll('button')).find(
      current => current.textContent?.trim() === '代码',
    ) as HTMLButtonElement | undefined
    expect(codeTab).toBeTruthy()

    codeTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    const sidebarLink = container.querySelector(
      'a[href="#/examples/attribute-bindings"]',
    ) as HTMLAnchorElement | null
    expect(sidebarLink).toBeTruthy()

    sidebarLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()
    await flush()

    expect(window.location.hash).toBe('#/examples/attribute-bindings')
    expect(container.textContent).toContain('Attribute 绑定（移植自 Vue）')
    expect(container.textContent).not.toContain('处理输入（移植自 Vue）')
  })

  it(
    'keeps code and preview tabs interactive after switching between real example routes',
    async () => {
      window.location.hash = '#/examples/hello-world'

      const LazyHelloWorld = useComponent(async () => ({ default: HelloWorld }))
      const LazyHandlingInput = useComponent(async () => ({ default: HandlingInput }))

      const router = createRouter({
        history: createWebHashHistory(),
        routes: [
          { path: '/', component: OtherRoute },
          { path: '/examples/hello-world', component: LazyHelloWorld },
          { path: '/examples/handling-input', component: LazyHandlingInput },
        ],
      })
      attachRouter(router)

      const container = mountTestContainer()
      render(<RouterView />, container)

      await flush()
      await flush()

      expect(container.textContent).toContain('你好，世界（移植自 Vue）')

      const handlingInputLink = container.querySelector(
        'a[href="#/examples/handling-input"]',
      ) as HTMLAnchorElement | null
      expect(handlingInputLink).toBeTruthy()

      handlingInputLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await flush()
      await flush()

      expect(window.location.hash).toBe('#/examples/handling-input')
      expect(container.textContent).toContain('处理输入（移植自 Vue）')
      expect(container.textContent).not.toContain('你好，世界（移植自 Vue）')

      const switchedCodeTab = Array.from(container.querySelectorAll('button')).find(
        current => current.textContent?.trim() === '代码',
      ) as HTMLButtonElement | undefined
      expect(switchedCodeTab).toBeTruthy()

      switchedCodeTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await flush()

      expect(container.querySelector('button[aria-label="复制代码"]')).toBeTruthy()
      expect(container.querySelector('a.link.link-primary[href="https://google.com"]')).toBeNull()

      const switchedPreviewTab = Array.from(container.querySelectorAll('button')).find(
        current => current.textContent?.trim() === '效果',
      ) as HTMLButtonElement | undefined
      expect(switchedPreviewTab).toBeTruthy()

      switchedPreviewTab?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
      await flush()

      expect(container.querySelector('a.link.link-primary[href="https://google.com"]')).toBeTruthy()
      expect(container.querySelector('button[aria-label="复制代码"]')).toBeNull()
    },
    slowTestTimeout,
  )

  it(
    'keeps example tabs interactive after switching away and back to a lazy route',
    async () => {
      window.location.hash = '#/examples/hello-world'

      const LazyHelloWorld = useComponent(async () => ({ default: HelloWorld }))
      const LazyHandlingInput = useComponent(async () => ({ default: HandlingInput }))

      const router = createRouter({
        history: createWebHashHistory(),
        routes: [
          { path: '/', component: OtherRoute },
          { path: '/examples/hello-world', component: LazyHelloWorld },
          { path: '/examples/handling-input', component: LazyHandlingInput },
        ],
      })
      attachRouter(router)

      const container = mountTestContainer()
      render(<RouterView />, container)

      await flush()
      await flush()

      expect(container.textContent).toContain('你好，世界（移植自 Vue）')

      router.push('/examples/handling-input')
      await flush()
      await flush()

      expect(container.textContent).toContain('处理输入（移植自 Vue）')

      router.push('/examples/hello-world')
      await flush()
      await flush()

      expect(window.location.hash).toBe('#/examples/hello-world')
      expect(container.textContent).toContain('你好，世界（移植自 Vue）')
      expect(container.textContent).not.toContain('处理输入（移植自 Vue）')

      const codeTab = Array.from(container.querySelectorAll('button')).find(
        current => current.textContent?.trim() === '代码',
      ) as HTMLButtonElement | undefined
      expect(codeTab).toBeTruthy()

      codeTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await flush()

      expect(container.querySelector('button[aria-label="复制代码"]')).toBeTruthy()
      expect(
        Array.from(container.querySelectorAll('.card .card-body h1')).some(
          current => current.textContent?.trim() === 'Hello World!',
        ),
      ).toBe(false)

      const previewTab = Array.from(container.querySelectorAll('button')).find(
        current => current.textContent?.trim() === '效果',
      ) as HTMLButtonElement | undefined
      expect(previewTab).toBeTruthy()

      previewTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      await flush()

      expect(
        Array.from(container.querySelectorAll('.card .card-body h1')).some(
          current => current.textContent?.trim() === 'Hello World!',
        ),
      ).toBe(true)
      expect(container.querySelector('button[aria-label="复制代码"]')).toBeNull()
    },
    slowTestTimeout,
  )
})
