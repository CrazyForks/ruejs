import { describe, expect, it, vi } from 'vitest'

import {
  h,
  jsx,
  jsxs,
  renderAnchor,
  setReactiveScheduling,
  signal,
  Suspense,
  TransitionGroup,
  useComponent,
  vapor,
  watchEffect,
  type FC,
} from '@rue-js/rue'
import {
  _$appendChild,
  _$createComment,
  _$createDocumentFragment,
  _$createElement,
  _$createTextNode,
} from '@rue-js/runtime'
import {
  _$createComponent as _$createVaporComponent,
  renderAnchor as vaporRenderAnchor,
  vapor as vaporBlock,
} from '@rue-js/runtime/vapor'
import {
  attachRouter,
  createMemoryHistory,
  createRouter,
  useAsyncRouteComponent,
  RouterLink,
  RouterView,
} from '@rue-js/router'
import { renderToString } from '@rue-js/server-renderer'
import { renderToString as renderToStringFromRue } from '@rue-js/rue/server-renderer'

describe('server renderToString', () => {
  it('renders text and escapes html-sensitive characters', async () => {
    await expect(renderToString('Rue <SSR> & friends')).resolves.toBe(
      'Rue &lt;SSR&gt; &amp; friends',
    )
  })

  it('renders a component tree through the server DOM adapter', async () => {
    const App: FC<{ title: string }> = props =>
      h(
        'section',
        { class: 'hero', 'data-title': props.title },
        h('h1', null, props.title),
        h('input', { disabled: true, value: 'ready' }),
      )

    await expect(renderToString(App, { props: { title: 'Rue SSR' } })).resolves.toBe(
      '<section class="hero" data-title="Rue SSR"><h1>Rue SSR</h1><input disabled value="ready"></section>',
    )
  })

  it('also exposes the renderer from the rue/server-renderer deep import', async () => {
    await expect(renderToStringFromRue(h('strong', null, 'deep import'))).resolves.toBe(
      '<strong>deep import</strong>',
    )
  })

  it('renders portable component handles that return primitive text', async () => {
    const Primitive: FC = () => 'portable text'

    await expect(renderToString(h(Primitive, null))).resolves.toBe('portable text')
  })

  it('renders component children passed through another component during SSR', async () => {
    const BaseWrapper: FC = props => h('article', null, props.children)
    const Wrapper: FC = props => h(BaseWrapper, null, props.children)
    const App: FC = () => h(Wrapper, null, h('h1', null, 'Nested SSR child'))

    await expect(renderToString(App)).resolves.toBe('<article><h1>Nested SSR child</h1></article>')
  })

  it('renders TransitionGroup children without running browser DOM effects', async () => {
    const App: FC = () =>
      h(
        TransitionGroup,
        { tag: 'ul', name: 'list' },
        h('li', { key: 'first' }, 'First'),
        h('li', { key: 'second' }, 'Second'),
      )

    await expect(renderToString(App)).resolves.toBe('<ul><li>First</li><li>Second</li></ul>')
  })

  it('renders JSX children passed through another component during SSR', async () => {
    const BaseWrapper: FC = props => jsx('article', { children: props.children })
    const Wrapper: FC = props => jsx(BaseWrapper, { children: props.children })
    const App: FC = () =>
      jsxs(Wrapper, {
        children: [jsx('h1', { children: 'Nested JSX child' }), jsx('p', { children: 'Body' })],
      })

    await expect(renderToString(App)).resolves.toBe(
      '<article><h1>Nested JSX child</h1><p>Body</p></article>',
    )
  })

  it('renders vapor children passed through a renderAnchor slot during SSR', async () => {
    const BaseVaporSlotWrapper: FC = props =>
      vaporBlock(() => {
        const article = _$createElement('article')
        const anchor = _$createComment('slot')
        _$appendChild(article, anchor)

        watchEffect(() => {
          vaporRenderAnchor(props.children as any, article as any, anchor as any)
        })

        return article
      }) as any
    const VaporSlotWrapper: FC = props =>
      vaporBlock(() => {
        const root = _$createDocumentFragment()
        const anchor = _$createComment('component')
        _$appendChild(root, anchor)

        watchEffect(() => {
          vaporRenderAnchor(
            _$createVaporComponent(BaseVaporSlotWrapper, { children: props.children }) as any,
            root as any,
            anchor as any,
          )
        })

        return root
      }) as any
    const App: FC = () =>
      _$createVaporComponent(VaporSlotWrapper, {
        children: vaporBlock(() => {
          const root = _$createDocumentFragment()
          const title = _$createElement('h1')
          _$appendChild(root, title)
          _$appendChild(title, _$createTextNode('Vapor slot child'))
          return root
        }) as any,
      }) as any

    await expect(renderToString(App)).resolves.toBe('<article><h1>Vapor slot child</h1></article>')
  })

  it('renders RouterView with memory history for SSR', async () => {
    const About: FC = () => h('h1', null, 'SSR route')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: () => h('h1', null, 'Home') },
        { path: '/about', component: About },
      ],
    })

    attachRouter(router)
    await router.push('/about')
    await router.isReady()

    await expect(renderToString(RouterView)).resolves.toContain('<h1>SSR route</h1>')
  })

  it('waits for lazy route components before SSR RouterView rendering', async () => {
    const LazyRoute = useAsyncRouteComponent(async () => ({
      default: () => h('h1', null, 'Lazy SSR route'),
    }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: () => h('h1', null, 'Home') },
        { path: '/lazy', component: LazyRoute },
      ],
    })

    attachRouter(router)
    await router.push('/lazy')
    await router.isReady()

    await expect(renderToString(RouterView)).resolves.toContain('<h1>Lazy SSR route</h1>')
  })

  it('renders nested RouterView inside a vapor route layout during SSR', async () => {
    const Layout: FC = () =>
      vaporBlock(() => {
        const section = _$createElement('section')
        const anchor = _$createComment('nested-router-view')
        _$appendChild(section, anchor)

        watchEffect(() => {
          vaporRenderAnchor(_$createVaporComponent(RouterView, null) as any, section as any, anchor)
        })

        return section
      }) as any
    const NestedRoute: FC = () => h('h1', null, 'Nested Vapor route')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: () => h('h1', null, 'Home') },
        {
          path: '/parent',
          component: Layout,
          children: [{ path: 'child', component: NestedRoute }],
        },
      ],
    })

    attachRouter(router)
    await router.push('/parent/child')
    await router.isReady()

    await expect(renderToString(RouterView)).resolves.toContain('<h1>Nested Vapor route</h1>')
  })

  it('renders RouterLink as a plain anchor during SSR without an installed router', async () => {
    const LinkApp: FC = () => h(RouterLink, { to: '/about' }, 'About')

    await expect(renderToString(LinkApp)).resolves.toBe('<a href="/about">About</a>')
  })

  it('ignores lazy hydration strategies while rendering async components on the server', async () => {
    const hydrateStrategy = vi.fn(() => {
      throw new Error('SSR should not install client hydration strategies.')
    })
    const LazyPanel = useComponent({
      loader: async () => ({
        default: () => h('h1', null, 'Lazy hydration SSR route'),
      }),
      hydrate: hydrateStrategy,
    })

    await expect(renderToString(LazyPanel)).resolves.toContain('<h1>Lazy hydration SSR route</h1>')
    expect(hydrateStrategy).not.toHaveBeenCalled()
  })

  it('renders Suspense children during SSR', async () => {
    const App: FC = () =>
      h(
        'main',
        null,
        h(
          Suspense,
          { fallback: h('span', null, 'Loading suspense panel') },
          h('strong', null, 'Ready'),
        ),
      )

    await expect(renderToString(App)).resolves.toContain('<strong>Ready</strong>')
  })

  it('renders nested async components during SSR', async () => {
    const LazyPanel = useComponent({
      loader: async () => ({
        default: () => h('strong', null, 'Nested async SSR panel'),
      }),
    })
    const App: FC = () => h('main', null, h(LazyPanel, null))

    await expect(renderToString(App)).resolves.toContain('<strong>Nested async SSR panel</strong>')
  })

  it('renders async components inside Suspense during SSR', async () => {
    const LazyPanel = useComponent({
      loader: async () => ({
        default: () => h('strong', null, 'Suspense SSR panel'),
      }),
    })
    const App: FC = () =>
      h(
        'main',
        null,
        h(Suspense, { fallback: h('span', null, 'Loading suspense panel') }, h(LazyPanel, null)),
      )

    await expect(renderToString(App)).resolves.toContain('<strong>Suspense SSR panel</strong>')
  })

  it('keeps the server DOM adapter active across overlapping async SSR renders', async () => {
    let resolveFirst!: (value: { default: FC }) => void
    let resolveSecond!: (value: { default: FC }) => void
    const FirstPanel = useComponent({
      loader: () =>
        new Promise<{ default: FC }>(resolve => {
          resolveFirst = resolve
        }),
    })
    const SecondPanel = useComponent({
      loader: () =>
        new Promise<{ default: FC }>(resolve => {
          resolveSecond = resolve
        }),
    })

    const firstRender = renderToString(FirstPanel)
    await Promise.resolve()
    const secondRender = renderToString(SecondPanel)
    await Promise.resolve()

    resolveFirst({ default: () => h('h1', null, 'First SSR panel') })
    await expect(firstRender).resolves.toContain('<h1>First SSR panel</h1>')

    resolveSecond({ default: () => h('h1', null, 'Second SSR panel') })
    await expect(secondRender).resolves.toContain('<h1>Second SSR panel</h1>')
  })

  it('disposes server render effects before restoring the browser DOM adapter', async () => {
    const label = signal('before', {}, true)
    let runs = 0
    const App: FC = () =>
      vapor(() => {
        const container = _$createElement('div')
        const anchor = _$createComment('late-ssr-update')
        _$appendChild(container, anchor)

        watchEffect(() => {
          runs += 1
          renderAnchor(h('span', null, label.get()), container, anchor)
        })

        return container
      }) as any

    await expect(renderToString(App)).resolves.toContain('<span>before</span>')

    label.set('after')
    await Promise.resolve()
    await Promise.resolve()

    expect(runs).toBe(1)
  })

  it('waits for frame-scheduled reactive updates before serializing SSR output', async () => {
    setReactiveScheduling('frame')

    try {
      const App: FC = () =>
        vapor(() => {
          const container = _$createElement('div')
          const anchor = _$createComment('frame-ssr-update')
          const label = signal('before', {}, true)
          _$appendChild(container, anchor)

          watchEffect(() => {
            renderAnchor(h('span', null, label.get()), container, anchor)
          })
          label.set('after')

          return container
        }) as any

      await expect(renderToString(App)).resolves.toContain('<span>after</span>')
    } finally {
      setReactiveScheduling('sync')
    }
  })
})
