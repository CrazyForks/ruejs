import { afterEach, describe, expect, it } from 'vitest'

import { attachRouter, createRouter, RouterView, type HistoryLike } from '@rue-js/router'

import { h, render, setReactiveScheduling, useComponent } from '../src'
import HelloWorld from '../../../app/pages/examples/HelloWorld'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const waitForContent = async (assertion: () => void, attempts = 40) => {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
    }

    await flush()
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  throw lastError
}

const createStaticHistory = (path: string): HistoryLike => ({
  location: () => path,
  push: () => {},
  replace: () => {},
  listen: () => {},
  back: () => {},
})

const createMemoryHistory = (initialPath: string): HistoryLike & { setPath: (path: string) => void } => {
  let currentPath = initialPath
  const listeners = new Set<() => void>()

  return {
    location: () => currentPath,
    push: path => {
      currentPath = path
      listeners.forEach(listener => listener())
    },
    replace: path => {
      currentPath = path
      listeners.forEach(listener => listener())
    },
    listen: cb => {
      listeners.add(cb)
    },
    back: () => {},
    setPath: path => {
      currentPath = path
      listeners.forEach(listener => listener())
    },
  }
}

describe('HelloWorld actual page', () => {
  it('renders with a real router context', async () => {
    const Empty = () => null
    const router = createRouter({
      history: createStaticHistory('/examples/hello-world'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/hello-world', component: HelloWorld as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(HelloWorld as any, null), container)
    await flush()

    expect(container.textContent).toContain('你好，世界（移植自 Vue）')
    expect(container.textContent).toContain('Hello World!')
  })

  it('renders when lazy-loaded without RouterView', async () => {
    const Empty = () => null
    const AsyncHelloWorld = useComponent(() => import('../../../app/pages/examples/HelloWorld'))
    const router = createRouter({
      history: createStaticHistory('/examples/hello-world'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/hello-world', component: AsyncHelloWorld as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(AsyncHelloWorld as any, { params: {} }), container)
    await waitForContent(() => {
      expect(container.textContent).toContain('你好，世界（移植自 Vue）')
      expect(container.textContent).toContain('Hello World!')
    })
  })

  it('renders through RouterView when lazy-loaded', async () => {
    const Empty = () => null
    const AsyncHelloWorld = useComponent(() => import('../../../app/pages/examples/HelloWorld'))
    const router = createRouter({
      history: createStaticHistory('/examples/hello-world'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/hello-world', component: AsyncHelloWorld as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<RouterView />, container)
    await waitForContent(() => {
      expect(container.textContent).toContain('你好，世界（移植自 Vue）')
      expect(container.textContent).toContain('Hello World!')
    })
  })

  it('renders when navigating from home to the lazy route', async () => {
    const Home = () => <section data-testid="home-page">home</section>
    const AsyncHelloWorld = useComponent(() => import('../../../app/pages/examples/HelloWorld'))
    const history = createMemoryHistory('/')
    const router = createRouter({
      history,
      routes: [
        { path: '/', component: Home as any },
        { path: '/examples/hello-world', component: AsyncHelloWorld as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<RouterView />, container)
    await flush()
    expect(container.textContent).toContain('home')

    history.push('/examples/hello-world')
    await waitForContent(() => {
      expect(container.textContent).toContain('你好，世界（移植自 Vue）')
      expect(container.textContent).toContain('Hello World!')
    })
  })
})