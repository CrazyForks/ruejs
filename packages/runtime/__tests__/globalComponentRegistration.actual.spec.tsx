import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createMemoryHistory, createRouter, RouterView } from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import GlobalComponentRegistration from '../../../app/pages/examples/GlobalComponentRegistration'
import ReactivePropsDestructure from '../../../app/pages/examples/ReactivePropsDestructure'
import GlobalComponentRegistrationDemo from '../../../app/pages/examples/home-demos/GlobalComponentRegistrationDemo'
import { click, mountContainer, waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const readText = (root: ParentNode) => (root.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('GlobalComponentRegistration actual demo', () => {
  it('mounts the inner registered component app and keeps list actions working', async () => {
    const container = mountContainer()

    render(<GlobalComponentRegistrationDemo />, container)

    await waitForContent(() => {
      expect(readText(container)).toContain('已注册 TodoItem')
      expect(readText(container)).toContain('TodoItem 来自字符串注册名')
      expect(readText(container)).toContain('定义 TodoItem 函数组件')
      expect(readText(container)).toContain('2/3')
    })

    const input = container.querySelector('input') as HTMLInputElement | null
    expect(input).not.toBeNull()
    input!.value = '新增运行时注册项'
    input!.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
    await click(findButton(container, '添加'))

    await waitForContent(() => {
      expect(readText(container)).toContain('新增运行时注册项')
      expect(readText(container)).toContain('2/4')
    })
  })

  it('unmounts the inner registered app when switching routes', async () => {
    const container = mountContainer()
    const router = createRouter({
      history: createMemoryHistory('/registered'),
      routes: [
        { path: '/registered', component: GlobalComponentRegistrationDemo },
        { path: '/other', component: () => <div data-testid="other-route">other</div> },
      ],
    })
    attachRouter(router)

    render(<RouterView />, container)

    await waitForContent(() => {
      expect(readText(container)).toContain('已注册 TodoItem')
      expect(readText(container)).toContain('TodoItem 来自字符串注册名')
    })

    await router.push('/other')

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="other-route"]')?.textContent).toBe('other')
      expect(readText(container)).not.toContain('TodoItem 来自字符串注册名')
    })

    render(null as any, container)
  })

  it('switches repeatedly between the registered app and reactive props pages', async () => {
    const container = mountContainer()
    const router = createRouter({
      history: createMemoryHistory('/examples/global-component-registration'),
      routes: [
        {
          path: '/examples/global-component-registration',
          component: GlobalComponentRegistration,
        },
        {
          path: '/examples/reactive-props-destructure',
          component: ReactivePropsDestructure,
        },
      ],
    })
    attachRouter(router)

    render(<RouterView />, container)

    for (let turn = 0; turn < 3; turn += 1) {
      await waitForContent(() => {
        expect(readText(container)).toContain('TodoItem 来自字符串注册名')
      })

      await router.push('/examples/reactive-props-destructure')
      await waitForContent(() => {
        expect(readText(container)).toContain('Reactive Props Destructure')
      })

      await router.push('/examples/global-component-registration')
    }

    await waitForContent(() => {
      expect(readText(container)).toContain('TodoItem 来自字符串注册名')
    })

    render(null as any, container)
  })
})
