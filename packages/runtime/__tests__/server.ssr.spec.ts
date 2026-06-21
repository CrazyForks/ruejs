import { describe, expect, it, vi } from 'vitest'

import { h, useComponent, type FC } from '@rue-js/rue'
import {
  attachRouter,
  createMemoryHistory,
  createRouter,
  defineAsyncRouteComponent,
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
    const LazyRoute = defineAsyncRouteComponent(async () => ({
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
})
