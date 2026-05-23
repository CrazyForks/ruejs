import { afterEach, describe, expect, it } from 'vitest'

import { attachRouter, createRouter, RouterView, type HistoryLike } from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import ContextPage from '../../../app/pages/examples/Context'

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

describe('Context example actual page', () => {
  it('renders through RouterView on the dedicated alias route', async () => {
    const Empty = () => null
    const router = createRouter({
      history: createStaticHistory('/examples/context'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/context', component: ContextPage as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<RouterView />, container)
    await waitForContent(() => {
      expect(container.textContent).toContain('Context（移植自 SolidJS）')
      expect(container.textContent).toContain('Context Demo')
      expect(container.textContent).toContain('缺少 Provider 时回退默认值')
    })
  })

  it('keeps the legacy /examples/context route working', async () => {
    const Empty = () => null
    const router = createRouter({
      history: createStaticHistory('/examples/context'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/context', component: ContextPage as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<RouterView />, container)
    await waitForContent(() => {
      expect(container.textContent).toContain('Context（移植自 SolidJS）')
      expect(container.textContent).toContain('Context Demo')
    })
  })

  it('updates shared context consumers after clicking increment', async () => {
    const Empty = () => null
    const router = createRouter({
      history: createStaticHistory('/examples/context'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/context', component: ContextPage as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<RouterView />, container)
    await waitForContent(() => {
      expect(container.textContent).toContain('当前共享计数')
      expect(container.textContent).toContain('1')
    })

    const incrementButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('+1'),
    ) as HTMLButtonElement | undefined

    incrementButton?.click()

    await waitForContent(() => {
      expect(container.textContent).toContain('当前共享计数')
      expect(container.textContent).toContain('2')
      expect(container.textContent).toContain('深层读取结果：2')
    })
  })
})
