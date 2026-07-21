// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  Component,
  createContext,
  h,
  onBeforeUnmount,
  onUnmounted,
  renderAnchor,
  setReactiveScheduling,
  signal,
  untrack,
  useApp,
  useSetup,
  vapor,
  watchEffect,
  type FC,
} from '../src'
import { appendChild, createComment, createElement } from '../src/dom'

setReactiveScheduling('microtask')

afterEach(() => {
  document.body.innerHTML = ''
})

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('renderAnchor component replacement', () => {
  it('removes component A when the same anchor replaces it with component B', async () => {
    const beforeUnmount = vi.fn()
    const unmounted = vi.fn()
    const First: FC = () => {
      onBeforeUnmount(beforeUnmount)
      onUnmounted(unmounted)
      return <p data-testid="first-route">first-route</p>
    }
    const Second: FC<{ params: { id: string } }> = ({ params }) => (
      <p data-testid="second-route">second-route {params.id}</p>
    )
    const RouteDepth = createContext(0)
    const RouteContent: FC<{ component: FC; params: { id: string } }> = ({ component, params }) => (
      <RouteDepth.Provider value={1}>{h(component, { params })}</RouteDepth.Provider>
    )
    const activeRoute = signal<'first' | 'second'>('first')
    const paramsSource = signal({ id: '7' }, {}, true)
    const params = new Proxy({} as { id: string }, {
      get: (_target, key) => paramsSource.get()[key as 'id'],
    })
    const AnchorOwner: FC = () => {
      const view = useSetup(() => {
        const parent = createElement('span') as HTMLElement
        const anchor = createComment('anchor') as Comment
        appendChild(parent, anchor)
        watchEffect(() => {
          const route = activeRoute.get()
          untrack(() => {
            const component = route === 'first' ? First : Second
            renderAnchor(
              h(Component, { is: RouteContent, key: route, component, params }) as any,
              parent as any,
              anchor as any,
            )
          })
        })
        return parent
      })
      return vapor(() => view)
    }
    const container = document.createElement('div')
    document.body.appendChild(container)

    useApp(AnchorOwner).mount(container)
    await flushEffects()
    expect(container.querySelector('[data-testid="first-route"]')?.textContent).toBe('first-route')

    activeRoute.set('second')
    await flushEffects()

    expect(container.querySelector('[data-testid="first-route"]')).toBeNull()
    expect(container.querySelector('[data-testid="second-route"]')?.textContent).toBe(
      'second-route 7',
    )
    expect(
      container.querySelectorAll('[data-testid="first-route"], [data-testid="second-route"]'),
    ).toHaveLength(1)
    expect(beforeUnmount).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
  })
})
